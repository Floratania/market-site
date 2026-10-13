import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalRows} from '../integration/refresh-commerce.mjs';
import {filterManageProducts} from '../public/manage-filters.js';
const row={Code:'S1',VariantRef:'0x00000000000000000000000000000000',Price:'150',PriceStatus:'candidate',AvailableMamaivtsi:'2',ReservedMamaivtsi:'1',AvailableMagala:'0',ReservedMagala:'0'};
const data=()=>({stockCheckedAt:new Date().toISOString(),catalogRows:[row]});
test('operational refresh uses available stock without subtracting reserve again, includes zero and validates before writes',()=>{
 const result=operationalRows(data(),[{sku:'S1'}]);assert.equal(result[0].stocks[0].quantity,2);assert.equal(result[0].stocks[0].reserved,1);assert.equal(result[0].stocks[1].quantity,0);assert.equal(result[0].price,150);
 assert.throws(()=>operationalRows(data(),[{sku:'missing'}]));
 assert.throws(()=>operationalRows({...data(),stockCheckedAt:'invalid'},[{sku:'S1'}]));
 assert.throws(()=>operationalRows({...data(),catalogRows:[{...row,Price:null}]},[{sku:'S1'}]));
});
test('management missing-data filters retain unpriced and inactive variants',()=>{
 const rows=[{sku:'A',name:'Двері',price:null,description:'',active:false},{sku:'B',name:'Вікно',price:100,description:'Опис',image:'/photo.jpg',active:true}];
 for(const filter of ['photo','description','price','inactive'])assert.deepEqual(filterManageProducts(rows,'',filter).map(p=>p.sku),['A']);
 assert.deepEqual(filterManageProducts(rows,'вік','active').map(p=>p.sku),['B']);
});
