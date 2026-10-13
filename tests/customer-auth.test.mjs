import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createCustomerAuth} from '../integration/customer-auth.mjs';
import {SELECTIONS_KEY} from '../integration/customer-selections.mjs';

async function fixture(t,{confirmation=true,https=false}={}){
 let clock=Date.now();
 const calls=[];
 const token=(id='customer-1')=>`header.${Buffer.from(JSON.stringify({exp:Math.floor((clock+60000)/1000),sub:id})).toString('base64url')}.secret`;
 const user={id:'customer-1',email:'buyer@example.com',firstName:'Ірина',lastName:'Тест',isStaff:true};
 const metadata=new Map();
 let auth;
 const server=http.createServer(async(req,res)=>auth.handle(req,res,new URL(req.url,'http://localhost')));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 const origin=https?base.replace('http:','https:'):base;
 auth=createCustomerAuth({saleorUrl:'https://saleor.example/graphql/',channel:'vs-market-ua',publicUrl:origin,now:()=>clock,
  json:(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));},
  readBody:async req=>{let bytes='';for await(const chunk of req)bytes+=chunk;return JSON.parse(bytes);},
  fetchImpl:async(_url,options)=>{
   const {query,variables}=JSON.parse(options.body);calls.push({query,variables,headers:options.headers});
   let data;
   const caller=options.headers.Authorization?JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1],'base64url')).sub:'customer-1';
   if(query.includes('mutation CustomerLogin')){const id=variables.email==='other@example.com'?'customer-2':'customer-1';data={tokenCreate:variables.password==='correct-password'?{token:token(id),refreshToken:'private-refresh',csrfToken:'private-csrf',user:{...user,id},errors:[]}:{token:null,user:null,errors:[{code:'INVALID_CREDENTIALS'}]}};}
   else if(query.includes('mutation CustomerRegister'))data={accountRegister:{requiresConfirmation:confirmation,errors:[]}};
   else if(query.includes('mutation CustomerRefresh'))data={tokenRefresh:{token:token(),errors:[]}};
   else if(query.includes('query CustomerMe'))data={me:{...user,id:caller}};
   else if(query.includes('query CustomerSelections'))data={me:{id:caller,metafield:metadata.get(caller)||null}};
   else if(query.includes('mutation CustomerSelectionsSave')){
    assert.equal(variables.id,caller);assert.equal(variables.input.length,1);assert.equal(variables.input[0].key,SELECTIONS_KEY);
    metadata.set(caller,variables.input[0].value);data={updateMetadata:{errors:[]}};
   }
   else if(query.includes('mutation CustomerUpdate'))data={accountUpdate:{user:{...user,...variables.input},errors:[]}};
   else if(query.includes('mutation CustomerPhoneSave')){assert.equal(variables.id,caller);assert.equal(variables.input[0].key,'storefront_phone');user.phone=variables.input[0].value;data={updateMetadata:{errors:[]}};}
   else if(query.includes('mutation CustomerReset'))data={requestPasswordReset:{errors:[{code:'NOT_FOUND'}]}};
   else if(query.includes('mutation CustomerConfirm'))data={confirmAccount:{errors:variables.token==='expired'?[{code:'INVALID_TOKEN'}]:[]}};
   else if(query.includes('mutation CustomerSetPassword'))data={setPassword:{errors:[]}};
   else throw new Error('Unexpected auth operation');
   return {ok:true,json:async()=>({data})};
  }});
 const request=(action,body,cookie='',headers={})=>fetch(`${base}/api/auth/${action}`,body===undefined?{headers:{...(cookie?{Cookie:cookie}:{}),...headers}}:{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:JSON.stringify(body)});
 return {request,calls,origin,metadata,advance:ms=>clock+=ms};
}

test('real auth boundary: registration whitelist, private cookie, refresh, profile and logout',async t=>{
 const app=await fixture(t);
 assert.deepEqual(await(await app.request('me')).json(),{user:null});
 const registration=await app.request('register',{email:'Buyer@Example.com',password:'correct-password',firstName:'Ірина',lastName:'Тест',isStaff:true,metadata:[{key:'admin',value:'true'}]});
 assert.equal(registration.status,201);assert.equal((await registration.json()).requiresConfirmation,true);
 const input=app.calls.at(-1).variables.input;
 assert.equal(input.email,'buyer@example.com');assert.equal(input.channel,'vs-market-ua');
 assert.equal(input.redirectUrl,app.origin+'/account/confirm');assert.equal(input.isStaff,undefined);assert.equal(input.metadata,undefined);
 const denied=await app.request('login',{email:'buyer@example.com',password:'wrong'});
 assert.equal(denied.status,401);assert.equal(denied.headers.get('Set-Cookie'),null);
 const login=await app.request('login',{email:'buyer@example.com',password:'correct-password'});
 assert.equal(login.status,200);
 const loginBody=await login.json();assert.equal(loginBody.user.email,'buyer@example.com');assert.equal(loginBody.user.isStaff,undefined);
 assert.equal(loginBody.token,undefined);assert.equal(loginBody.refreshToken,undefined);
 const cookie=login.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.doesNotMatch(cookie,/private-refresh|private-csrf|\.secret/);
 const sessionCookie=cookie.split(';')[0];
 assert.equal((await(await app.request('me',undefined,sessionCookie)).json()).user.id,'customer-1');
 app.advance(65000);
 assert.equal((await(await app.request('me',undefined,sessionCookie)).json()).user.id,'customer-1');
 const refresh=app.calls.find(call=>call.query.includes('mutation CustomerRefresh'));
 assert.equal(refresh.variables.refreshToken,'private-refresh');assert.equal(refresh.variables.csrfToken,'private-csrf');
 const profile=await app.request('profile',{firstName:'Олена',lastName:'Тест',customerId:'someone-else'},sessionCookie);
 assert.equal(profile.status,200);assert.equal((await profile.json()).user.firstName,'Олена');
 assert.deepEqual(app.calls.at(-1).variables,{input:{firstName:'Олена',lastName:'Тест'}});
 const logout=await app.request('logout',{},sessionCookie);assert.equal(logout.status,200);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.deepEqual(await(await app.request('me',undefined,sessionCookie)).json(),{user:null});
 assert.equal((await app.request('profile',{firstName:'Олена',lastName:''},sessionCookie)).status,401);
});
test('account lists merge guests, synchronize two sessions, preserve removals and reject other owners',async t=>{
 const app=await fixture(t);
 const login=async email=>(await app.request('login',{email,password:'correct-password'})).headers.get('Set-Cookie').split(';')[0];
 const first=await login('buyer@example.com'),second=await login('buyer@example.com'),other=await login('other@example.com');
 assert.equal((await app.request('selections')).status,401);
 const merge={id:'guest-1',type:'merge',favorites:['v1','v2'],comparison:['v1']};
 const send=(cookie,operations,owner='customer-1')=>app.request('selections',{owner,operations},cookie);
 assert.equal((await send(first,[merge])).status,200);
 assert.deepEqual((await(await app.request('selections',undefined,second)).json()).favorites,['v1','v2']);
 const remove={id:'remove-1',type:'remove',list:'favorites',item:'v1'};
 await Promise.all([send(first,[remove]),send(second,[{id:'add-1',type:'add',list:'favorites',item:'v3'}])]);
 assert.deepEqual((await(await app.request('selections',undefined,second)).json()).favorites,['v2','v3']);
 await send(first,[merge]); // An uncertain/retried login merge must not resurrect removed items.
 assert.deepEqual((await(await app.request('selections',undefined,first)).json()).favorites,['v2','v3']);
 assert.equal((await send(other,[remove])).status,409);
 assert.equal((await send(first,[remove],'customer-2')).status,409);
 assert.deepEqual((await(await app.request('selections',undefined,other)).json()).favorites,[]);
 assert.equal((await app.request('selections',{owner:'customer-1',operations:[remove]},first,{Origin:'https://bad.example'})).status,403);
 const capped=await(await send(second,[{id:'large-compare',type:'merge',favorites:[],comparison:['a','b','c','d']}])).json();
 assert.equal(capped.comparison.length,4);assert.equal(capped.overflow.length,1);
 assert.equal((await send(first,[{id:'bad',type:'add',list:'isStaff',item:'x'}])).status,400);
 const saved=JSON.parse(app.metadata.get('customer-1'));assert.deepEqual(saved.favorites,['v2','v3']);
 assert.equal(saved.isStaff,undefined);
 await app.request('logout',{},first);
 assert.equal((await app.request('selections',undefined,first)).status,401);
 const fresh=await login('buyer@example.com');assert.deepEqual((await(await app.request('selections',undefined,fresh)).json()).favorites,['v2','v3']);
});

test('auth rejects foreign origins and invalid input, limits attempts, and protects recovery privacy',async t=>{
 const app=await fixture(t,{https:true});
 const credentials={email:'buyer@example.com',password:'correct-password'};
 assert.equal((await app.request('login',credentials,'',{Origin:'https://attacker.example'})).status,403);
 assert.equal((await app.request('login',credentials,'',{'Content-Type':'text/plain'})).status,415);
 assert.equal((await app.request('register',{...credentials,firstName:'Ірина',lastName:'',password:'123'})).status,400);
 assert.equal((await app.request('register',{...credentials,firstName:'Ірина',lastName:'',email:'bad-email'})).status,400);
 assert.equal((await app.request('confirm',{email:'buyer@example.com',token:'expired'})).status,400);
 assert.equal((await app.request('confirm',{email:'buyer@example.com',token:'valid',password:'correct-password'})).status,200);
 const reset=await app.request('password-reset',{email:'unknown@example.com'});
 assert.equal(reset.status,200);assert.deepEqual(await reset.json(),{ok:true});
 assert.equal(app.calls.at(-1).variables.redirectUrl,app.origin+'/account/reset');
 const login=await app.request('login',credentials);assert.match(login.headers.get('Set-Cookie'),/Secure/);
 const cookie=login.headers.get('Set-Cookie').split(';')[0];
 app.advance(25*3600*1000);assert.deepEqual(await(await app.request('me',undefined,cookie)).json(),{user:null});
 for(let i=0;i<20;i++)assert.equal((await app.request('login',{...credentials,password:'wrong'})).status,401);
 assert.equal((await app.request('login',credentials)).status,429);
});
test('phone is validated and saved only for the authenticated user, visible across sessions',async t=>{
 const app=await fixture(t),login=await app.request('login',{email:'buyer@example.com',password:'correct-password'}),cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await app.request('profile',{firstName:'Ірина',lastName:'',phone:'bad'},cookie)).status,400);
 const saved=await app.request('profile',{firstName:'Ірина',lastName:'',phone:'+380 (66) 670-97-77',customerId:'other'},cookie);
 assert.equal(saved.status,200);assert.equal((await saved.json()).user.phone,'+380666709777');
 assert.equal(app.calls.at(-1).variables.id,'customer-1');
 assert.equal((await(await app.request('me',undefined,cookie)).json()).user.phone,'+380666709777');
});
