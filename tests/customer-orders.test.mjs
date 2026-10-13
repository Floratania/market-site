import test from 'node:test';
import assert from 'node:assert/strict';
import {customerOrders} from '../integration/customer-orders.mjs';
test('orders belong to an authenticated ID, not to a browser-supplied email or name',()=>{
 const order={id:'order-1',createdAt:'2026-10-09T12:00:00Z',customerId:'u1',customer:{email:'same@example.com',phone:'private'},delivery:'manager',lines:[{sku:'s1',name:'Двері',quantity:2,unitPrice:123.45,currency:'UAH'}]};
 const records=[{order,notifications:{email:{status:'pending'}}},{order:{...order,id:'other',customerId:'u2'}},{order:{...order,id:'guest',customerId:undefined}}];
 const result=customerOrders(records,'u1');assert.equal(result.length,1);assert.equal(result[0].id,'order-1');assert.equal(result[0].customer,undefined);assert.equal(result[0].customerId,undefined);assert.equal(result[0].notifications,undefined);assert.equal(result[0].lines[0].unitPrice,123.45);assert.equal(customerOrders(records,'u3').length,0);
});
