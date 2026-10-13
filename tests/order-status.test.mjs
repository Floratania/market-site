import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createOrderStore} from '../integration/order-store.mjs';
test('statuses persist without changing order or notification data, and stale updates fail',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vs-status-'));
 try{
 const store=createOrderStore({directory,settings:async()=>({acceptOrders:true})}),id=crypto.randomUUID(),order={id,status:'received',createdAt:new Date().toISOString(),customer:{id:'buyer'},lines:[{sku:'A',quantity:1,unitPrice:100}]};
 await store.submit(order,{test:true});
 let previous='received';for(const status of ['confirmed','shipped','completed','cancelled','received']){await store.setStatus({id,status,expectedStatus:previous},'staff');previous=status;}
 const record=await store.find(id);assert.equal(record.statusHistory.length,5);assert.deepEqual(record.order.lines,order.lines);assert.equal(record.statusHistory[0].actor,'staff');
 await assert.rejects(store.setStatus({id,status:'shipped',expectedStatus:'confirmed'},'staff'),{status:409});
 await assert.rejects(store.setStatus({id,status:'fake',expectedStatus:'received'},'staff'),{status:400});
 await assert.rejects(store.setStatus({id:crypto.randomUUID(),status:'received',expectedStatus:'received'},'staff'),{status:404});
 const reopened=createOrderStore({directory});assert.equal((await reopened.list())[0].order.status,'received');assert.ok(!('statusHistory' in (await reopened.list())[0]));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('failed reservation leaves the order status and history unchanged',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vs-reservation-fail-'));
 try{const store=createOrderStore({directory,settings:async()=>({acceptOrders:true}),onStatusChange:async()=>{throw Object.assign(new Error('Недостатньо залишку'),{status:409});}}),id=crypto.randomUUID();
 await store.submit({id,status:'received',createdAt:new Date().toISOString(),lines:[{sku:'LAST',quantity:1,unitPrice:100}]},{test:true});
 await assert.rejects(store.setStatus({id,status:'confirmed',expectedStatus:'received'},'staff'),{status:409});const record=await store.find(id);assert.equal(record.order.status,'received');assert.equal(record.statusHistory,undefined);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
