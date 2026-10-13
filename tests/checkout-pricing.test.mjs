import test from 'node:test';import assert from 'node:assert/strict';
import {buildQuote,paymentPreference,promoPreview} from '../integration/checkout-pricing.mjs';
const products=[{id:'v1',sku:'SKU',slug:'model',name:'Модель',variantName:'960 × 2050 мм',price:1000}];
test('quotes use server prices and reject duplicate or unavailable SKUs',async()=>{
 const q=await buildQuote({lines:[{sku:'SKU',quantity:2,price:1}],promoCode:''},products);assert.equal(q.total,2000);assert.equal(q.lines[0].unitPrice,1000);
 await assert.rejects(buildQuote({lines:[{sku:'SKU',quantity:1},{sku:'SKU',quantity:1}]},products),{status:400});
 await assert.rejects(buildQuote({lines:[{sku:'missing',quantity:1}]},products),{status:409});
 assert.equal(paymentPreference('bank_transfer','pickup').status,'unpaid');assert.throws(()=>paymentPreference('card','nova_poshta'),{status:409});assert.throws(()=>paymentPreference('cash_pickup','nova_poshta'),{status:400});assert.throws(()=>paymentPreference('cod','pickup'),{status:400});
});
test('native promo preview uses exact variants, subtotal discount, and cleans its temporary checkout',async()=>{
 const calls=[];const api=async(q,v,token)=>{calls.push({q,v,token});if(q.includes('QuoteCheckout'))return {checkoutCreate:{checkout:{id:'temp'},errors:[]}};if(q.includes('QuotePromo'))return {checkoutAddPromoCode:{errors:[],checkout:{subtotalPrice:{gross:{amount:1800,currency:'UAH'}},voucherCode:'CODE',discountName:'10%'}}};return {checkoutDelete:{errors:[]}};};
 const q=await buildQuote({lines:[{sku:'SKU',quantity:2}],promoCode:'CODE'},products,{api,adminToken:async()=> 'test-token'});
 assert.equal(q.discount,200);assert.equal(q.total,1800);assert.equal(q.promotion.confirmation,'manager');assert.equal(calls[0].v.input.lines[0].variantId,'v1');assert.ok(calls[2].q.includes('QuoteCleanup'));assert.equal(calls[0].token,undefined);
});
test('invalid or non-discount promo codes never change the total and checkout is removed',async()=>{
 let cleanup=0;const api=async(q)=>q.includes('QuoteCheckout')?{checkoutCreate:{checkout:{id:'temp'},errors:[]}}:q.includes('QuotePromo')?{checkoutAddPromoCode:{errors:[{code:'VOUCHER_NOT_APPLICABLE'}],checkout:null}}:(cleanup++,{checkoutDelete:{errors:[]}});
 await assert.rejects(promoPreview('BAD',[{variantId:'v1',quantity:1,unitPrice:100}],null,{api,adminToken:async()=> 'token'}),{status:400});assert.equal(cleanup,1);
});
