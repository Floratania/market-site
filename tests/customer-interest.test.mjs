import test from 'node:test';
import assert from 'node:assert/strict';
import {interestReport,cleanCart,loadInterest} from '../integration/customer-interest.mjs';
test('interest counts distinct customers and exact variants, not duplicate favorites or cart quantity',()=>{
 const products=[{id:'a',name:'Двері',sku:'A',productId:'model',variantName:'960 × 2050 · Білий · R'}];
 const data=interestReport([{id:'u1',email:'a@test.ua',selections:JSON.stringify({favorites:['a','a']}),cart:JSON.stringify({lines:[{id:'a',quantity:3}]})},{id:'u2',email:'b@test.ua',selections:'{}',cart:JSON.stringify({lines:[{id:'a',quantity:2}]})}],products);
 assert.equal(data.ranking[0].customers,2);assert.equal(data.ranking[0].favorites,1);assert.equal(data.ranking[0].carts,2);assert.equal(data.ranking[0].quantity,5);assert.equal(data.withCart,2);assert.equal(data.customers[0].cart[0].variantName,products[0].variantName);
 assert.throws(()=>cleanCart([{id:'a',quantity:-1}]));assert.throws(()=>cleanCart([{id:'a',quantity:1},{id:'a',quantity:2}]));
});
test('report reads all customer pages and handles removed products',async()=>{
 let calls=0;
 const data=await loadInterest(async(_,variables)=>{calls++;assert.equal(variables.after,calls===1?null:'next');return {customers:{edges:[{node:{id:'u'+calls,email:'test@example.ua',selections:JSON.stringify({favorites:['removed']})}}],pageInfo:{hasNextPage:calls===1,endCursor:'next'}}};},[]);
 assert.equal(calls,2);assert.equal(data.ranking[0].customers,2);assert.equal(data.ranking[0].name,'Товар недоступний');
});
