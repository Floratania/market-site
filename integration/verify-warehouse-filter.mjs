import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8790';
const response=await fetch(base+'/api/catalog');assert.equal(response.ok,true);const catalog=await response.json();assert.ok(catalog.products?.length);
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');assert.equal(await (await fetch(base+'/app.js?v=20261008-12')).text(),source);
const elements=new Map();const element=key=>{if(!elements.has(key))elements.set(key,{value:'',textContent:'',innerHTML:'',hidden:true,dataset:{},style:{},checked:false,classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},focus(){},querySelector(){return element('button')},querySelectorAll(){return []}});return elements.get(key)};
const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{theme:'light'}},body:{style:{}}},location:{href:base+'/catalog',search:''},localStorage:{getItem(){return null},setItem(){}},URL,URLSearchParams,Intl,Date,Map,Set,fetch:async()=>({ok:true,json:async()=>catalog})});
vm.runInContext(source,context);await vm.runInContext('catalogReady',context);assert.match(element('#filter-groups').innerHTML,/Наявність на складі/);
const counts={};
for(const location of ['mamaivtsi','magala','any']){
 vm.runInContext('state.stockLocation='+JSON.stringify(location)+';renderCatalog()',context);
 const actual=JSON.parse(vm.runInContext('JSON.stringify(catalogCards().matching.map(p=>p.id).sort())',context));
 const expected=catalog.products.filter(p=>catalog.stock.some(s=>s.sku===p.sku&&(location==='any'?['mamaivtsi','magala'].includes(s.location):s.location===location)&&Number(s.quantity)>0)).map(p=>p.id).sort();assert.deepEqual(actual,expected);counts[location]=actual.length;
}
const html=await (await fetch(base+'/catalog?warehouse=mamaivtsi')).text();assert.ok(html.includes('/app.js?v=20261008-12')&&html.includes('/product-media.css?v=20261008-12'));
console.log(JSON.stringify({verified:true,snapshotAt:catalog.stockSnapshotAt,availableVariants:counts}));
