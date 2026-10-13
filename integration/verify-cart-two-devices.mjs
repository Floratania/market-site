import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const base='http://127.0.0.1:8790',credentials={email:`cart-check-${crypto.randomUUID()}@example.invalid`,password:crypto.randomBytes(32).toString('base64url')};
async function python(script,input){await new Promise((resolve,reject)=>{const child=spawn('docker',['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{windowsHide:true,stdio:['pipe','ignore','ignore']});child.on('error',reject);child.on('exit',code=>code?reject(new Error('Fixture command failed')):resolve());child.stdin.end(JSON.stringify(input));});}
async function request(action,body,cookie){const r=await fetch(base+'/api/auth/'+action,{headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),data=await r.json();assert.equal(r.status,200,data.error);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
await python('import sys,json; from saleor.account.models import User; d=json.load(sys.stdin); u=User(email=d["email"],is_confirmed=True,is_active=True);u.set_password(d["password"]);u.save()',credentials);
try{const one=await request('login',credentials),two=await request('login',credentials),owner=one.data.user.id;const products=(await(await fetch(base+'/api/catalog')).json()).products;const a={id:products[0].id,quantity:2},b={id:products[1].id,quantity:1};
 await request('cart',{owner,lines:[a],base:[],custom:{}},one.cookie);assert.deepEqual((await request('cart',null,two.cookie)).data.lines,[a]);
 await request('cart',{owner,lines:[b],custom:{},merge:true},two.cookie);assert.equal((await request('cart',null,one.cookie)).data.lines.length,2);
 await request('cart',{owner,lines:[],base:[a],custom:{},baseCustom:{}},one.cookie);assert.deepEqual((await request('cart',null,two.cookie)).data.lines,[b]);
 console.log('Verified real buyer accounts: cart restored in second session, guest merge, exact quantities, cross-device removal.');
}finally{await python('import sys,json; from saleor.account.models import User; d=json.load(sys.stdin); User.objects.filter(email=d["email"],is_staff=False).delete()',{email:credentials.email});}
