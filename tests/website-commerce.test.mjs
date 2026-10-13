import test from 'node:test';import assert from 'node:assert/strict';import {websiteCommerce} from '../integration/website-commerce.mjs';
test('confirmation commits the validated price and coupon once; crash recovery does not consume again',async()=>{
 const ledger=new Map();let commits=0,previews=0;
 const quote=async()=>{previews++;return {subtotal:100,discount:10,total:90,promotion:{code:'CODE',confirmation:'manager'}};};
 const command=async input=>{if(input.operation==='lookup')return ledger.get(input.id)||null;if(input.operation==='prepare')return {fingerprint:'rules'};if(input.operation==='commit'){commits++;const value={released:false,allocations:[{sku:'SKU',location:'mamaivtsi',quantity:1}],pricing:input.order.pricing};ledger.set(input.order.id,value);return value;}if(input.operation==='release'){ledger.get(input.order.id).released=true;return {released:true,allocations:[]};}return {items:[]};};
 const commerce=websiteCommerce({catalog:async()=>[{sku:'SKU',price:100}],refresh:async()=>{},command,quote});
 const order={id:'test',status:'received',customer:{email:'x@example.com'},lines:[{sku:'SKU',quantity:1,unitPrice:100}],pricing:{total:90,promotion:{code:'CODE'}}};
 const saved=await commerce.change(order,'confirmed');assert.equal(saved.pricing.promotion.confirmation,'applied');
 const recovered=await commerce.change(order,'confirmed');assert.equal(recovered.pricing.total,90);assert.equal(commits,1);assert.equal(previews,1);
 await assert.rejects(commerce.change({...order,status:'shipped',commerce:saved.commerce},'cancelled'),{status:409});
 const cancelled=await commerce.change({...order,status:'confirmed',commerce:saved.commerce},'cancelled');assert.equal(cancelled.commerce.released,true);
});
test('price changes or confirmation failures leave a pending order unconfirmed',async()=>{
 let committed=false;const commerce=websiteCommerce({catalog:async()=>[{sku:'SKU',price:101}],refresh:async()=>{},quote:async()=>({total:101,subtotal:101,discount:0}),command:async input=>input.operation==='lookup'?null:input.operation==='prepare'?{}:(committed=true,{})});
 await assert.rejects(commerce.change({id:'id',status:'received',customer:{},lines:[{sku:'SKU',quantity:1,unitPrice:100}],pricing:{total:100}},'confirmed'),{status:409});assert.equal(committed,false);
 await assert.rejects(commerce.change({status:'received'},'shipped'),{status:409});
});
