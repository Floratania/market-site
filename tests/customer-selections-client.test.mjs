import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {readSelections,applyOperations,publicSelections} from '../integration/customer-selections.mjs';
const source=await fs.readFile(new URL('../public/customer-selections.js',import.meta.url),'utf8');
function device(server,saved=new Map()){
 let owner=null,offline=false,hold=null;const events={};
 const storage={get length(){return saved.size},key:index=>[...saved.keys()][index],getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
 const context=vm.createContext({crypto,URLSearchParams,location:{search:''},localStorage:storage,document:{visibilityState:'visible',querySelector:()=>null,querySelectorAll:()=>[]},setInterval(){},addEventListener:(name,fn)=>events[name]=fn,fetch:async(_url,options)=>{
  if(offline)throw new Error('offline');
  if(hold)await hold;
  if(!owner)return {ok:false,status:401,json:async()=>({error:'login'})};
  let data=server.get(owner)||readSelections();let overflow=[];
  if(options.body){const body=JSON.parse(options.body);if(body.owner!==owner)return {ok:false,status:409,json:async()=>({error:'owner'})};const result=applyOperations(data,body.operations);data=result.data;overflow=result.overflow;server.set(owner,data);}
  return {ok:true,json:async()=>({owner,...publicSelections(data),overflow})};
 }});
 vm.runInContext(source,context);
 return {api:context.VSMarketSelections,saved,events,as:id=>owner=id,offline:value=>offline=value,hold:promise=>hold=promise};
}
const value=device=>JSON.parse(JSON.stringify(device.api.value()));
test('two devices merge guest selections, propagate removals and isolate logout and another account',async()=>{
 const server=new Map(),first=device(server,new Map([['vs-market-selections-v1',JSON.stringify({favorites:['guest'],comparison:['guest']})]])),second=device(server);
 first.as('a');await first.api.connect({id:'a'});
 assert.deepEqual(value(first),{favorites:['guest'],comparison:['guest']});
 assert.deepEqual(JSON.parse(first.saved.get('vs-market-selections-v1')),{favorites:[],comparison:[]});
 second.as('a');await second.api.connect({id:'a'});assert.deepEqual(value(second),value(first));
 second.api.toggle('favorites','guest');await second.api.sync();await first.api.sync();assert.deepEqual(value(first).favorites,[]);
 first.api.toggle('favorites','private-a');await first.api.sync();
 first.as(null);await first.api.connect(null);assert.deepEqual(value(first).favorites,[]);
 first.api.toggle('favorites','guest-b');first.as('b');await first.api.connect({id:'b'});
 assert.deepEqual(value(first).favorites,['guest-b']);assert.deepEqual(server.get('a').favorites,['private-a']);
});
test('offline changes survive reload scoped to their owner and retry without reintroducing removals',async()=>{
 const server=new Map(),first=device(server);first.as('a');await first.api.connect({id:'a'});
 first.offline(true);first.api.toggle('favorites','offline');await first.api.sync();
 const other=device(server,first.saved);other.as('b');await other.api.connect({id:'b'});assert.deepEqual(value(other).favorites,[]);
 const reloaded=device(server,first.saved);reloaded.as('a');await reloaded.api.connect({id:'a'});assert.deepEqual(value(reloaded).favorites,['offline']);
 const second=device(server);second.as('a');await second.api.connect({id:'a'});second.api.toggle('favorites','offline');await second.api.sync();
 await reloaded.api.sync();assert.deepEqual(value(reloaded).favorites,[]);
});
test('changes made during a pending merge stay queued and both survive',async()=>{
 const server=new Map(),first=device(server);first.as('a');let release;
 first.hold(new Promise(resolve=>release=resolve));const connecting=first.api.connect({id:'a'});
 first.api.toggle('favorites','during-connect');first.hold(null);release();await connecting;
 assert.deepEqual(value(first).favorites,['during-connect']);assert.deepEqual(server.get('a').favorites,['during-connect']);
});
