import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingDirections,readyHighlights} from '../public/home-discovery.js';
const product=(id,type,price=100,extra={})=>({id,sku:id,productId:id,category:type==='Вікно'?'Вікна':'Двері',price,media:[{url:'/photo.jpg'}],specifications:[{key:'product_type',value:type}],...extra});
test('shopping directions retain exact source types and only show types present in catalogue',()=>{
 const groups=shoppingDirections([product('1','Двері стандарт'),product('2','Двері Standart+'),product('3','Вікно'),product('4','невідомий тип')]);
 assert.equal(groups.length,2);
 assert.deepEqual(groups.find(g=>g.label==='Стандартні двері').types,['Двері стандарт','Двері Standart+']);
 assert.equal(groups.find(g=>g.label==='Стандартні двері').count,2);
 assert.equal(groups.find(g=>g.category==='Вікна').count,1);
 assert.equal(groups.find(g=>g.category==='Вікна').image,'/photo.jpg');
});
test('home highlights use available exact SKUs and diversify models without implying discounts',()=>{
 const products=[product('w','Вікно'),product('t','Двері технічні'),product('a','Двері металеві в квартиру'),product('s','Двері стандарт'),product('s2','Двері стандарт',90,{productId:'s'}),product('zero','Вікно',1),product('unpriced','Вікно',null),product('reserved','Вікно',1)];
 const stock={verified:false,snapshotAt:'2026-10-08T11:30:00Z',items:products.map(p=>({sku:p.sku,location:'mamaivtsi',quantity:['zero','reserved'].includes(p.sku)?0:1}))};
 const selected=readyHighlights(products,stock);
 assert.equal(selected.length,4);assert.equal(new Set(selected.map(p=>p.productId)).size,4);
 assert.deepEqual(new Set(selected.map(p=>p.specifications[0].value)),new Set(['Вікно','Двері технічні','Двері металеві в квартиру','Двері стандарт']));
 assert.ok(selected.every(p=>!['zero','reserved','unpriced'].includes(p.sku)));
 assert.deepEqual(readyHighlights(products,{...stock,snapshotAt:null}),[]);
 assert.equal(readyHighlights(products,{...stock,snapshotAt:null,verified:true}).length,4);
 assert.deepEqual(readyHighlights(products,{...stock,items:[]}),[]);
});
