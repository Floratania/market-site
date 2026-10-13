// Isolated UI preview. It uses temporary orders and never sends notifications.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createOrderStore} from '../integration/order-store.mjs';
import {createManageApi} from '../integration/manage-api.mjs';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vs-status-preview-'));
const orders=createOrderStore({directory,settings:async()=>({acceptOrders:true})});
await orders.submit({id:crypto.randomUUID(),status:'received',createdAt:new Date().toISOString(),customer:{name:'Тестове замовлення',phone:'+380000000000'},delivery:'nova_poshta',shipping:{city:'Чернівці',warehouse:'Тестове відділення'},lines:[{name:'Тестова комплектація',variantName:'960 × 2050 мм · Білий · R',sku:'TEST-ONLY',quantity:1,unitPrice:10000}]},{test:true});
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
const manage=createManageApi({publicUrl:'http://127.0.0.1:18794',orders,catalog:async()=>[],json,readBody:async req=>{let s='';for await(const c of req)s+=c;return JSON.parse(s);},auth:{requireStaff:async()=>({user:{id:'test-staff',email:'test@example.invalid'},permissions:['MANAGE_ORDERS','MANAGE_PRODUCTS']})}});
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(await manage(req,res,url))return;const file=path.resolve('public',url.pathname==='/manage'?'manage.html':'.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
server.listen(18794,'127.0.0.1',()=>console.log('Isolated order preview: http://127.0.0.1:18794/manage'));
process.on('SIGINT',()=>server.close(async()=>{await fs.rm(directory,{recursive:true,force:true});process.exit();}));
