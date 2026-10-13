import test from 'node:test';
import assert from 'node:assert/strict';
import { specificationsFor } from '../integration/catalog-specifications.mjs';
const meta = values => Object.entries(values).map(([key,value]) => ({key,value}));
test('variant specifications override product values without exposing internal metadata', () => {
  const specs = specificationsFor(meta({color:'Білий',width:'850',purchase_cost:'secret',public_specs:JSON.stringify([{key:'glass',label:'Склопакет',value:'Двокамерний',filterable:true,sourceRef:'private'}])}),meta({color:'Антрацит',width:'950',width_unit:'мм'}));
  assert.equal(specs.find(item => item.key === 'color').value,'Антрацит');
  assert.equal(specs.find(item => item.key === 'width').unit,'мм');
  assert.equal(specs.find(item => item.key === 'width').scope,'variant');
  assert.equal(specs.some(item => item.key === 'purchase_cost'),false);
  assert.equal(specs.find(item => item.key === 'glass').sourceRef,undefined);
  assert.equal(specificationsFor(meta({width:'850'}))[0].unit,'','no assumed mm for unverified dimensions');
});
test('malformed or unresolved specifications are rejected', () => {
  assert.deepEqual(specificationsFor(meta({public_specs:'not json'})),[]);
  assert.deepEqual(specificationsFor(meta({public_specs:'{"key":"color"}'})),[]);
  const specs = specificationsFor(meta({public_specs:JSON.stringify([null,{key:'bad]"',label:'Bad',value:'Test'},{key:'color',label:'Колір',value:{ref:'unresolved'}},{key:'profile',label:'Профіль',value:'Example',filterable:'true'}])}));
  assert.equal(specs.length,1);
  assert.equal(specs[0].filterable,false,'filter publication requires explicit boolean');
});
test('opening side override replaces R/L while preserving the independent opening kind',()=>{
 const source=meta({opening:'Поворотно-відкидне',opening_direction:'R'});
 const specs=specificationsFor(source,meta({storefront_specs:JSON.stringify([{key:'opening_direction',label:'Сторона відкривання',value:'L'}])}));
 assert.equal(specs.find(s=>s.key==='opening_direction').value,'L');assert.equal(specs.find(s=>s.key==='opening').value,'Поворотно-відкидне');
});
