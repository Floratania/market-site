import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const script=await fs.readFile(new URL('../public/proposal.js',import.meta.url),'utf8');
test('proposal renders safe exact SKU prices and flags unpriced work without submitting an order',async()=>{
 const loadedPhoto={complete:true,naturalWidth:410,parentElement:{textContent:''},decode:async()=>{throw new Error('Decode failure despite a loaded image');}};
 const elements=new Map(),calls=[];const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:true,textContent:'',innerHTML:'',addEventListener(){},querySelectorAll(){return id==='proposal-document'?[loadedPhoto]:[]}});return elements.get(id);};
 const quote={id:'abcdefgh-uuid',createdAt:'2026-10-12T10:00:00Z',lines:[{name:'Двері <img>',image:'http://localhost/photo.jpg',variantName:'960 × 2050 · R',sku:'SKU',quantity:2,unitPrice:1000},{name:'Індивідуальне вікно',variantName:'850 × 2000',sku:null,quantity:1,unitPrice:null}],subtotal:2000,discount:200,total:1800,hasUnpriced:true,promotion:{code:'TEST<10'}};
 const context=vm.createContext({document:{getElementById:element},VSMarketShop:{ready:Promise.resolve(),cartLines:()=>[{product:{sku:'SKU'},quantity:2}]},location:{search:'?from=checkout'},sessionStorage:{getItem:()=>JSON.stringify({recipient:'<script>bad</script>',promoCode:'TEST<10'})},URLSearchParams,Intl,Date,window:{print(){}},fetch:async(url,opts)=>{calls.push(url);return {ok:true,json:async()=>quote};}});
 await vm.runInContext(script,context);const html=element('proposal-document').innerHTML;
 assert.match(html,/SKU/);assert.match(html,/960 × 2050/);assert.match(html,/1.?800/);assert.match(html,/не включені/);assert.match(html,/src="http:\/\/localhost\/photo.jpg"/);assert.match(html,/Фото не знайдено в базі даних/);assert.doesNotMatch(html,/<script>|<img>/);assert.equal(element('proposal-print').disabled,false);assert.deepEqual(calls,['/api/quote']);
 assert.equal(loadedPhoto.parentElement.textContent,'','a loaded image remains visible even if decode would reject');
});
test('empty cart does not create a proposal or enable printing',async()=>{
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{disabled:true,addEventListener(){}});return elements.get(id);};
 await vm.runInContext(script,vm.createContext({document:{getElementById:el},VSMarketShop:{ready:Promise.resolve(),cartLines:()=>[]},window:{print(){}}}));assert.match(el('proposal-status').textContent,/порожній/);assert.equal(el('proposal-print').disabled,true);
});
