import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCartChanges} from '../integration/customer-interest.mjs';
test('two devices keep unrelated products and honor removal instead of reintroducing stale items',()=>{
 const a={id:'a',quantity:1},b={id:'b',quantity:2};
 const saved=applyCartChanges({lines:[a,b],custom:{}},{base:[a],lines:[]});assert.deepEqual(saved.lines,[b]);
 const changed=applyCartChanges(saved,{base:[a],lines:[a,{id:'c',quantity:1}]});assert.deepEqual(changed.lines,[b,{id:'c',quantity:1}]);
});
test('guest merge is idempotent and custom configurations survive cross-device updates',()=>{
 const item={quantity:1,design:{width:900,height:2000}};
 const body={merge:true,lines:[{id:'a',quantity:2}],custom:{'custom-test':item}};
 const first=applyCartChanges({lines:[{id:'a',quantity:1}],custom:{}},body);
 assert.deepEqual(applyCartChanges(first,body),first);
 const removed=applyCartChanges(first,{lines:first.lines,base:first.lines,custom:{},baseCustom:first.custom});assert.deepEqual(removed.custom,{});
});
