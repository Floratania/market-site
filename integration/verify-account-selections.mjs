import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
const base='http://127.0.0.1:8790';
const credentials={email:`selection-check-${crypto.randomUUID()}@example.invalid`,password:crypto.randomBytes(32).toString('base64url')};
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
async function python(script,input){
 return new Promise((resolve,reject)=>{
  const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
  let diagnostics='';child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>diagnostics+=chunk);
  child.on('error',reject);child.on('exit',code=>code?reject(new Error('Local verification account setup failed: '+diagnostics.replaceAll(credentials.password,'[omitted]'))):resolve());
  child.stdin.end(JSON.stringify(input));
 });
}
async function request(action,body,cookie){
 const response=await fetch(base+'/api/auth/'+action,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})}});
 const data=await response.json();assert.equal(response.status,200,data.error||action);return {response,data};
}
await python('import sys,json; from saleor.account.models import User; data=json.load(sys.stdin); user=User(email=data["email"],is_confirmed=True,is_active=True); user.set_password(data["password"]); user.save()',credentials);
try{
 const one=await request('login',credentials),two=await request('login',credentials);
 const cookie1=one.response.headers.get('set-cookie').split(';')[0],cookie2=two.response.headers.get('set-cookie').split(';')[0];
 const products=(await(await fetch(base+'/api/catalog')).json()).products;
 const ids=products.slice(0,2).map(p=>p.id),owner=one.data.user.id;
 await request('selections',{owner,operations:[{id:crypto.randomUUID(),type:'merge',favorites:ids,comparison:[ids[0]]}]},cookie1);
 assert.deepEqual((await request('selections',null,cookie2)).data.favorites,ids);
 await request('selections',{owner,operations:[{id:crypto.randomUUID(),type:'remove',list:'favorites',item:ids[0]}]},cookie2);
 assert.deepEqual((await request('selections',null,cookie1)).data.favorites,[ids[1]]);
 await python('import sys,json; from saleor.account.models import User; data=json.load(sys.stdin); user=User.objects.get(email=data["email"]); saved=user.metadata.get("vsmarket:selections:v1"); assert saved and json.loads(saved)["favorites"]==data["expected"]', {email:credentials.email,expected:[ids[1]]});
 for(const route of ['/catalog','/account/login']){
  const html=await(await fetch(base+route)).text();const header=html.match(/<header[\s\S]*?<\/header>/)[0];
  assert.match(header,/class="shopping-tools"/);assert.match(html,/customer-selections.js/);
 }
 const asset=await fetch(base+'/customer-selections.js');assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);
 console.log('Verified: two real customer sessions, native Saleor PostgreSQL account metadata, removals, header controls and served synchronization script.');
}finally{
 await python('import sys,json; from saleor.account.models import User; data=json.load(sys.stdin); User.objects.filter(email=data["email"],is_staff=False).delete()', {email:credentials.email});
}
