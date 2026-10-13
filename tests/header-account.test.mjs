import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/account-session.js',import.meta.url),'utf8');
async function header({user=null,logoutFails=false,accountPage=false}={}){
 const elements=new Map(),saved=new Map(),calls=[],connected=[],events={};
 const element=key=>{
  if(!elements.has(key))elements.set(key,{hidden:true,disabled:false,value:'',dataset:{},listeners:{},attrs:{},classList:{contains:()=>accountPage,toggle(key,value){this[key]=value}},setAttribute(key,value){this.attrs[key]=value},addEventListener(key,value){this.listeners[key]=value}});
  return elements.get(key);
 };
 const location={pathname:accountPage?'/account':'/catalog',search:'?warehouse=magala',hash:'',assign(value){this.assigned=value}};
 const context=vm.createContext({URLSearchParams,Date,crypto:{randomUUID:()=> 'change-id'},location,document:{querySelector:element,documentElement:{dataset:{theme:'dark'}},body:{classList:{contains:()=>accountPage}}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},VSMarketSelections:{async connect(user){connected.push(user?.id||null)},async sync(){}},addEventListener(key,value){events[key]=value},fetch:async(url,options)=>{
  calls.push({url,options});if(url.endsWith('/logout')){if(logoutFails)return {ok:false};user=null;return {ok:true};}
  return {ok:true,json:async()=>({user})};
 }});context.window=context;
 vm.runInContext(source,context);await context.customerReady;await new Promise(resolve=>setImmediate(resolve));
 return {element,location,calls,connected,events,saved};
}
test('header shows login for guests, then authenticated logout clears the local private view',async()=>{
 const guest=await header();assert.equal(guest.element('#header-logout').hidden,true);assert.equal(guest.element('#account-label').textContent,'Увійти');assert.match(guest.element('#account-link').href,/\/account\/login\?next=/);
 const signed=await header({user:{id:'buyer',firstName:'Ірина'}});assert.equal(signed.element('#header-logout').hidden,false);assert.equal(signed.element('#account-label').textContent,'Мій кабінет');assert.equal(signed.element('.account-actions').classList['is-authenticated'],true);
 await signed.element('#header-logout').listeners.click();
 assert.equal(signed.element('#header-logout').hidden,true);assert.equal(signed.element('#account-label').textContent,'Увійти');assert.deepEqual(signed.connected,['buyer',null]);
 const logout=signed.calls.find(call=>call.url.endsWith('/logout'));assert.equal(logout.options.method,'POST');assert.equal(logout.options.credentials,'same-origin');assert.equal(logout.options.body,'{}');assert.equal(signed.saved.get('vs-market-account-change'),'change-id');
});
test('failed header logout keeps the account and its saved lists; successful profile logout leaves the profile',async()=>{
 const failed=await header({user:{id:'buyer'},logoutFails:true});await failed.element('#header-logout').listeners.click();assert.equal(failed.element('#header-logout').hidden,false);assert.equal(failed.element('#header-logout').disabled,false);assert.deepEqual(failed.connected,['buyer']);assert.match(failed.element('#selection-status').textContent,/Не вдалося вийти/);
 const profile=await header({user:{id:'buyer'},accountPage:true});await profile.element('#header-logout').listeners.click();assert.match(profile.location.assigned,/^\/account\/login/);
});
