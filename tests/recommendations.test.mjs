import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendationsFor,recommendationSettings} from '../integration/recommendations.mjs';
const product=(sku,price,extra={})=>({id:sku,productId:sku,sku,price,active:true,availableTotal:2,specifications:[{key:'width',value:'960',unit:'мм'},{key:'height',value:'2050',unit:'мм'},{key:'product_type',value:'Двері'},{key:'color',label:'Колір',value:sku==='a'?'Білий':'Графіт'}],...extra});
test('verified exact SKU accessories only, active priced stock and explanation required',()=>{
 const a=product('a',100,{recommendationSettings:{cross:[{sku:'b',reason:'Підтверджені кріплення',verified:true},{sku:'c',reason:'Не перевірено'},{sku:'d',reason:'Немає залишку',verified:true}],upsell:[]}});
 const rows=recommendationsFor(a,[a,product('b',20),product('c',20),product('d',20,{availableTotal:0})]);assert.deepEqual(rows.cross,[{sku:'b',reason:'Підтверджені кріплення',source:'manual'}]);
});
test('alternatives keep dimensions and type and explain an actual attribute difference',()=>{
 const a=product('a',100),b=product('b',150),bad=product('c',200,{specifications:[{key:'width',value:'850',unit:'мм'}]});
 const rows=recommendationsFor(a,[a,b,bad]);assert.equal(rows.upsell.length,1);assert.equal(rows.upsell[0].sku,'b');assert.match(rows.upsell[0].reason,/Графіт/);assert.equal(recommendationsFor({...a,specifications:[]},[a,b]).upsell.length,0);
 assert.deepEqual(recommendationSettings([{key:'storefront_recommendations',value:'broken'}]),{cross:[],upsell:[]});
});
test('door screen appears as an optional related item with a fitting warning',()=>{
 const door=product('door',100,{category:'Двері',specifications:[...product('door',100).specifications.filter(s=>s.key!=='product_type'),{key:'construction_kind',value:'1.ПВХ конструкції'},{key:'product_type',value:'Двері стандарт'}]}),mesh=product('НФ-00001746',1295,{category:'Москітні сітки',availableTotal:1});
 const result=recommendationsFor(door,[door,mesh]);assert.equal(result.related[0].sku,mesh.sku);assert.match(result.related[0].reason,/уточнить менеджер/);assert.equal(result.cross.length,0);
 assert.equal(recommendationsFor(product('window',100,{category:'Вікна'}),[door,mesh]).related.length,0);
 assert.equal(recommendationsFor(door,[door,{...mesh,availableTotal:0}]).related.length,0);
});
