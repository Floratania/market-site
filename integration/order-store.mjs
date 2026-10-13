import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {orderSettings,notificationChannels,notificationsReady,acceptingOrders,sendNotification} from './order-notifications.mjs';
import {validateStatusChange} from './order-status.mjs';
const defaultDir=fileURLToPath(new URL('./orders/',import.meta.url));
export function createOrderStore({directory=process.env.ORDER_STORAGE_DIR||defaultDir,settings=orderSettings,notify=sendNotification,onStatusChange,onSettle}={}) {
  let queue=Promise.resolve();
  const serial=job=>{const work=queue.then(job);queue=work.catch(()=>{});return work;};
  const filename=id=>path.join(directory,`${id}.json`);
  const write=async record=>{
    const file=filename(record.order.id),temporary=file+'.tmp';
    await fs.writeFile(temporary,JSON.stringify(record,null,2)+'\n',{mode:0o600});
    await fs.rename(temporary,file);
  };
  const create=async record=>{
    const temporary=path.join(directory,`${record.order.id}.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary,JSON.stringify(record,null,2)+'\n',{mode:0o600});
    try{await fs.link(temporary,filename(record.order.id));return true;}
    catch(error){if(error.code==='EEXIST')return false;throw error;}
    finally{await fs.unlink(temporary);}
  };
  const workerLock=async()=>{
    const file=path.join(directory,'.notification-worker.lock');
    try{const handle=await fs.open(file,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid}));await handle.close();return async()=>fs.unlink(file);}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      let owner;try{owner=JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}
      try{process.kill(owner.pid,0);return null;}catch(error){if(error.code!=='ESRCH')return null;}
      try{await fs.unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}
      return workerLock();
    }
  };
  const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const find=async(id,input)=>{
    if(!uuid(id))throw Object.assign(new Error('Оновіть сторінку оформлення'),{status:400});
    try {
      const record=JSON.parse(await fs.readFile(filename(id),'utf8'));
      if(input&&record.fingerprint!==fingerprint(input))throw Object.assign(new Error('Дані замовлення змінилися. Оновіть сторінку.'),{status:409});
      return record;
    } catch(error){if(error.code==='ENOENT')return null;throw error;}
  };
  const submit=(order,input)=>serial(async()=>{
    const previous=await find(order.id,input);
    if(previous)return {id:previous.order.id,replayed:true};
    const config=await settings();
    if(!acceptingOrders(config))throw Object.assign(new Error('Оформлення тимчасово недоступне. Зателефонуйте нам: +380 66 670 97 77.'),{status:503});
    await fs.mkdir(directory,{recursive:true,mode:0o700});
    const record={order,fingerprint:fingerprint(input),notifications:Object.fromEntries(notificationChannels(config).map(channel=>[channel,{status:'pending',attempts:0}]))};
    if(!await create(record)){const existing=await find(order.id,input);return {id:existing.order.id,replayed:true};}
    return {id:order.id,replayed:false};
  });
  const flush=()=>serial(async()=>{
    const config=await settings();
    if(!notificationsReady(config))return;
    let files;try{files=await fs.readdir(directory);}catch(error){if(error.code==='ENOENT')return;throw error;}
    const unlock=await workerLock();if(!unlock)return;
    try{
    for(const file of files.filter(name=>/^[0-9a-f-]+\.json$/i.test(name))) {
      const record=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
      for(const [channel,state] of Object.entries(record.notifications)) {
        if(!notificationChannels(config).includes(channel))continue;
        if(state.status==='sent'||Date.parse(state.nextAttemptAt||0)>Date.now())continue;
        state.attempts++;
        try {await notify(channel,record.order,config);state.status='sent';state.sentAt=new Date().toISOString();delete state.nextAttemptAt;}
        catch {state.status='pending';state.nextAttemptAt=new Date(Date.now()+Math.min(3600000,60000*2**Math.min(state.attempts-1,6))).toISOString();}
        await write(record);
      }
    }
    }finally{await unlock();}
  });
  const ready=async()=>acceptingOrders(await settings());
  const list=async()=>{
    let files;try{files=await fs.readdir(directory);}catch(error){if(error.code==='ENOENT')return [];throw error;}
    const records=[];
    for(const file of files.filter(name=>/^[0-9a-f-]+\.json$/i.test(name))){
      const record=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
      records.push({order:record.order,notifications:Object.fromEntries(Object.entries(record.notifications||{}).map(([key,value])=>[key,{status:value.status}]))});
    }
    return records.sort((a,b)=>String(b.order.createdAt).localeCompare(String(a.order.createdAt)));
  };
  const setStatus=(body,actor)=>serial(async()=>{
    validateStatusChange(body);
    if(!await find(body.id))throw Object.assign(new Error('Замовлення не знайдено.'),{status:404});
    const unlock=await workerLock();if(!unlock)throw Object.assign(new Error('Замовлення зараз оновлюється. Спробуйте ще раз.'),{status:409});
    try{
      const record=await find(body.id);if(!record)throw Object.assign(new Error('Замовлення не знайдено.'),{status:404});
      const current=record.order.status||'received';
      if(current!==body.expectedStatus)throw Object.assign(new Error('Статус вже змінив інший адміністратор. Оновіть список.'),{status:409});
      const changes=onStatusChange?await onStatusChange(record.order,body.status,current):{};
      Object.assign(record.order,changes);
      if(current!==body.status||Object.keys(changes).length){
        const at=new Date().toISOString();record.order.status=body.status;record.order.statusUpdatedAt=at;
        record.statusHistory=[...(record.statusHistory||[]),{from:current,to:body.status,at,actor:actor||null}];
        await write(record);
      }
      return {id:record.order.id,status:record.order.status||'received',statusUpdatedAt:record.order.statusUpdatedAt||null,...(record.order.commerce?{commerce:record.order.commerce}:{}),...(record.order.pricing?{pricing:record.order.pricing}:{})};
    }finally{await unlock();}
  });
  const settle=(body,actor)=>serial(async()=>{
    if(!body||!uuid(body.id)||typeof body.reference!=='string'||body.reference.trim().length<3||body.reference.length>120||!onSettle)throw Object.assign(new Error('Перевірте замовлення та номер документа обліку.'),{status:400});
    if(!await find(body.id))throw Object.assign(new Error('Замовлення не знайдено.'),{status:404});
    const unlock=await workerLock();if(!unlock)throw Object.assign(new Error('Замовлення зараз оновлюється.'),{status:409});
    try{const record=await find(body.id);record.order.commerce=await onSettle(record.order,body.reference.trim());record.statusHistory=[...(record.statusHistory||[]),{type:'accounting-settlement',at:new Date().toISOString(),actor}];await write(record);return {id:record.order.id,commerce:record.order.commerce};}finally{await unlock();}
  });
  return {submit,find,flush,ready,list,setStatus,settle};
}
