import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichmentFor,uniqueProductPhotos} from '../integration/product-enrichment.mjs';
import {modelIdentity,groupModels} from '../integration/model-grouping.mjs';
test('conflicting dimensions and internal flags do not become public specifications',()=>{
 const property=(name,value)=>({ProductRef:'p',PropertyName:name,ValueType:'0x08',ReferenceType:'0x0000006C',ReferencedValue:value});
 const source={checkedAt:'now',products:[{ProductRef:'p',WidthRaw:900,HeightRaw:2000}],properties:[property('Ширина','800'),property('Висота','2000'),property('Модель','ВИЯСНИТИ ?'),property('Вивантажено на сайт','Так'),property('Колір','Білий')]};
 const result=enrichmentFor(source);assert.equal(result.issues.length,2);
 assert.deepEqual(result.products[0].specs.map(s=>s.key),['height','color']);assert.equal(result.products[0].specs[0].unit,'мм');
 const photos=uniqueProductPhotos([{sha256:'a',fileRef:'1',isMain:false},{sha256:'a',fileRef:'2',isMain:true},{sha256:'b',fileRef:'3',isMain:false}]);assert.equal(photos.length,2);assert.equal(photos[0].fileRef,'2');
});
test('model grouping merges dimensions, finish and handing while preserving technical and quality distinctions',()=>{
 const rows=[
  {ProductRef:'1',Code:'SKU1',Name:'Двері стандарт TS1 (950*1950) Зовні горіх R',Price:'100'},
  {ProductRef:'2',Code:'SKU2',Name:'Двері стандарт TS1 (900*2050) Зовні золотий дуб L',Price:'200'},
  {ProductRef:'3',Code:'SKU3',Name:'Двері стандарт SP110 (900*2050) Зовні золотий дуб L',Price:'200'},
  {ProductRef:'4',Code:'SKU4',Name:'Двері стандарт TS1 (900*2050) Зовні золотий дуб L (Неліквід)',Price:'80'},
  {ProductRef:'5',Code:'SKU5',Name:'Двері стандарт TS1 (900*2050) Зовні золотий дуб L',Price:null},
 ];
 const groups=groupModels(rows,{products:[]});assert.equal(groups.length,3);assert.equal(groups.find(g=>g.name==='Двері стандарт TS1').members.length,2);
 const first=modelIdentity({ProductRef:'6',Name:'Вікно Фікс+Поворотно-відкидне Olimpia (1500*1000) Білий R'});
 const second=modelIdentity({ProductRef:'7',Name:'Вікно Поворотно-відкидне Olimpia (1500*1000) Білий R'});assert.notEqual(first.key,second.key);
});
test('two-field 1C gabarits fill door width and height in millimetres, with explicit property priority',()=>{
 const product={ProductRef:'door',Name:'Двері standart+ Сигара (960*2050) Зовні піщаний антрацит R',LengthRaw:960,WidthRaw:2050,HeightRaw:0};
 let result=enrichmentFor({products:[product],properties:[]});
 assert.deepEqual(result.products[0].specs.map(s=>[s.key,s.value,s.unit]),[['width','960','мм'],['height','2050','мм']]);
 assert.deepEqual(result.products[0].dimensionSources,{width:'gabarit:length',height:'gabarit:width'});
 result=enrichmentFor({products:[product],properties:[{ProductRef:'door',PropertyName:'Ширина',ValueType:'0x08',ReferenceType:'0x0000006C',ReferencedValue:'950'}]});
 assert.equal(result.products[0].specs.find(s=>s.key==='width').value,'950');
 assert.equal(result.products[0].dimensionSources.width,'property');
 result=enrichmentFor({products:[{...product,Name:'Eco Nova Inside (960*2050) L',GroupName:'Двері Аплот'}],properties:[]});
 assert.deepEqual(result.products[0].specs.map(s=>s.value),['960','2050']);
});
test('ambiguous gabarits are not guessed and full three-field dimensions retain existing mapping',()=>{
 const result=enrichmentFor({products:[
  {ProductRef:'bad',Name:'Двері (900*2000)',LengthRaw:960,WidthRaw:2050,HeightRaw:0},
  {ProductRef:'full',Name:'Двері (900*2000)',LengthRaw:100,WidthRaw:900,HeightRaw:2000},
  {ProductRef:'other',Name:'Профіль (960*2050)',LengthRaw:960,WidthRaw:2050,HeightRaw:0},
 ],properties:[]});
 assert.deepEqual(result.products[0].specs,[]);
 assert.deepEqual(result.products[1].specs.map(s=>s.value),['900','2000']);
 assert.deepEqual(result.products[2].specs,[]);
 assert.equal(result.issues.filter(i=>i.reason==='ambiguous-gabarit-dimensions').length,2);
});
