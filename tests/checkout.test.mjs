import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createOrderStore} from '../integration/order-store.mjs';
import {notificationsReady,sendNotification,orderText} from '../integration/order-notifications.mjs';
import {novaCities,novaWarehouses,validateNovaDelivery} from '../integration/nova-poshta.mjs';

const config={email:{enabled:true,to:'owner@example.com',from:'shop@example.com',host:'smtp.example.com',user:'shop',password:'test'},telegram:{enabled:true,botToken:'test-token',chatId:'12345'}};
const order={id:'00000000-0000-4000-8000-000000000001',createdAt:'2026-10-09T10:00:00.000Z',customer:{name:'Test <name>',phone:'+380501234567',email:'buyer@example.com'},delivery:'nova_poshta',shipping:{kind:'branch',city:'Чернівці',warehouse:'Відділення №1',verified:true},comment:'Please call',lines:[{sku:'SKU-1',quantity:2,name:'Двері',variantName:'960 × 2050 мм, праві',unitPrice:150,currency:'UAH'}]};
test('orders are persisted before notifications; retries only failed channels and idempotency rejects changed content',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vsmarket-orders-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const sent=[];let fail=true;
  const store=createOrderStore({directory,settings:async()=>config,notify:async(channel)=>{sent.push(channel);if(channel==='telegram'&&fail)throw new Error('offline');}});
  const input={lines:[{sku:'SKU-1',quantity:2}]};
  const first=await store.submit(order,input);
  assert.equal(first.replayed,false);
  let saved=JSON.parse(await fs.readFile(path.join(directory,order.id+'.json'),'utf8'));
  assert.equal(saved.notifications.email.status,'pending');assert.equal(sent.length,0,'durable save precedes network sends');
  await store.flush();
  saved=JSON.parse(await fs.readFile(path.join(directory,order.id+'.json'),'utf8'));
  assert.equal(saved.notifications.email.status,'sent');assert.equal(saved.notifications.telegram.status,'pending');
  assert.equal((await store.submit(order,input)).replayed,true);
  await assert.rejects(store.submit(order,{lines:[{sku:'SKU-1',quantity:3}]}),{status:409});
  fail=false;saved.notifications.telegram.nextAttemptAt=new Date(0).toISOString();await fs.writeFile(path.join(directory,order.id+'.json'),JSON.stringify(saved));
  const restarted=createOrderStore({directory,settings:async()=>config,notify:async(channel)=>{sent.push(channel);}});
  await restarted.flush();
  assert.deepEqual(sent,['email','telegram','telegram'],'already sent email is not repeated after restart');
  assert.equal((await restarted.find(order.id,input)).notifications.telegram.status,'sent');
});
test('missing notification credentials disable checkout without saving a pretend order',async t=>{
  assert.equal(notificationsReady(config),true);
  assert.equal(notificationsReady({...config,telegram:{enabled:true,botToken:'',chatId:''}}),false);
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vsmarket-orders-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const store=createOrderStore({directory,settings:async()=>({})});await assert.rejects(store.submit(order,{}),{status:503});assert.equal((await fs.readdir(directory)).length,0);
  await assert.rejects(store.find('../private',{}),{status:400});
});
test('parallel local instances create one order and run a single notification worker',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vsmarket-parallel-orders-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  let release,started;const gate=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;});
  let count=0;
  const params={directory,settings:async()=>({...config,telegram:{enabled:false}}),notify:async()=>{count++;started();await gate;}};
  const first=createOrderStore(params),second=createOrderStore(params);
  const results=await Promise.all([first.submit(order,{}),second.submit(order,{})]);assert.equal(results.filter(result=>!result.replayed).length,1);
  const work=first.flush();await began;await second.flush();assert.equal(count,1);release();await work;assert.equal((await first.find(order.id)).notifications.email.status,'sent');
});
test('explicit local acceptance saves orders with pending notifications while credentials are deferred',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vsmarket-local-only-orders-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const config={acceptOrders:true,email:{enabled:true},telegram:{enabled:true}};let sent=0;
  const store=createOrderStore({directory,settings:async()=>config,notify:async()=>sent++});
  assert.equal(await store.ready(),true);assert.equal((await store.submit(order,{})).replayed,false);await store.flush();assert.equal(sent,0);
  const saved=await store.find(order.id);assert.equal(saved.notifications.email.status,'pending');assert.equal(saved.notifications.telegram.status,'pending');
});
test('email and Telegram contain delivery, exact SKU and server price; customer text cannot inject Telegram markup',async()=>{
  let mail;await sendNotification('email',order,config,{mailTransport:{async sendMail(message){mail=message;return {accepted:['owner@example.com'],rejected:[]};}}});
  assert.equal(mail.to,'owner@example.com');assert.equal(mail.replyTo,'buyer@example.com');assert.match(mail.text,/Відділення №1/);assert.match(mail.text,/SKU-1/);assert.match(mail.text,/300 грн/);
  let request;await sendNotification('telegram',order,config,{fetchImpl:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true})};}});
  assert.equal(request.chat_id,'12345');assert.equal(request.parse_mode,undefined);assert.match(request.text,/Test <name>/);
  assert.match(orderText({...order,shipping:{kind:'address',city:'Чернівці',street:'Головна',house:'1',apartment:'2',verified:false}}),/Головна, 1, кв. 2/);
});
test('Nova Poshta uses fixed official endpoint; verifies warehouse belongs to the selected city and canonicalizes its name',async()=>{
  const city='00000000-0000-4000-8000-000000000010',branch='00000000-0000-4000-8000-000000000011';
  let posted;
  const fetchImpl=async(url,options)=>{assert.equal(url,'https://api.novaposhta.ua/v2.0/json/');posted=JSON.parse(options.body);return {ok:true,json:async()=>({success:true,data:posted.calledMethod==='getCities'?[{Ref:city,Description:'Чернівці',AreaDescription:'Чернівецька'}]:[{Ref:branch,CityRef:city,CityDescription:'Чернівці',Description:'Відділення №1: офіційна адреса',TotalMaxWeightAllowed:'1100'}]})};};
  assert.equal((await novaCities('Чернівці тест',{},fetchImpl))[0].ref,city);
  assert.equal((await novaWarehouses(city,'1',{},fetchImpl))[0].maxWeight,1100);
  const shipping=await validateNovaDelivery({kind:'branch',city:'Forged city',warehouse:'Forged branch',cityRef:city,warehouseRef:branch},{},fetchImpl);
  assert.equal(shipping.city,'Чернівці');assert.equal(shipping.warehouse,'Відділення №1: офіційна адреса');assert.equal(shipping.verified,true);
  await assert.rejects(validateNovaDelivery({kind:'branch',city:'Чернівці',warehouse:'1',cityRef:city,warehouseRef:'invalid'},{},fetchImpl),{status:400});
  const manual=await validateNovaDelivery({kind:'branch',city:'Чернівці',warehouse:'Відділення №2'},{},fetchImpl);assert.equal(manual.verified,false);
  await assert.rejects(validateNovaDelivery({kind:'address',city:'Чернівці',street:'',house:''},{},fetchImpl),{status:400});
});
