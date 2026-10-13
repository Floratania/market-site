import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCustomers} from '../integration/manage-customers.mjs';
test('customer orders match account ID, never shared email; order permission omits histories',async()=>{
 const graphql=async()=>({customers:{edges:[{node:{id:'buyer',email:'same@test.ua',firstName:'Тест',phone:'+380661234567',isActive:true,dateJoined:'2026-10-12'}}],pageInfo:{hasNextPage:false}}});
 const records=[{order:{id:'own',customerId:'buyer',lines:[{quantity:2,unitPrice:100}]}},{order:{id:'other',customerId:'other',customer:{email:'same@test.ua'},lines:[]}}];
 const result=await loadCustomers(graphql,records);assert.equal(result.users[0].orders.length,1);assert.equal(result.users[0].orders[0].total,200);assert.equal(result.users[0].orders[0].id,'own');
 assert.equal(Object.hasOwn((await loadCustomers(graphql,null)).users[0],'orders'),false);
});
