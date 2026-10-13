import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const dockerEnv={...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH};
async function python(script,input={}){
 return new Promise((resolve,reject)=>{
  const process=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{cwd:new URL('./',import.meta.url),stdio:['pipe','pipe','pipe'],windowsHide:true,env:dockerEnv});
  let stdout='';process.stdout.on('data',chunk=>stdout+=chunk);process.stdin.end(JSON.stringify(input));
  process.on('error',()=>reject(new Error('Docker verification unavailable')));
  process.on('exit',code=>code===0?resolve(stdout):reject(new Error('Local Saleor verification failed')));
 });
}
await python(`from django.conf import settings
from saleor.plugins.models import PluginConfiguration
assert settings.EMAIL_HOST=='mailpit' and int(settings.EMAIL_PORT)==1025
for plugin in PluginConfiguration.objects.filter(active=True,identifier='mirumee.notifications.user_email'):
 config={field['name']:field['value'] for field in plugin.configuration}
 assert config.get('host') in [None,'','mailpit'] and int(config.get('port') or 1025)==1025
print('Local-only mail delivery verified')`);
const port=18794,base=`http://127.0.0.1:${port}`;
const email=`qa-customer-${crypto.randomUUID()}@vsmarket.invalid`;
const oldPassword=crypto.randomBytes(20).toString('base64url');
const newPassword=crypto.randomBytes(20).toString('base64url');
const mailIds=new Set();
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('./',import.meta.url),env:{...process.env,PORT:String(port),STOREFRONT_PUBLIC_URL:base,SALEOR_GRAPHQL_URL:'http://127.0.0.1:8000/graphql/',SALEOR_CHANNEL:'vs-market-ua'},stdio:'ignore',windowsHide:true});
let registered=false;
async function request(action,body,cookie){
 const response=await fetch(`${base}/api/auth/${action}`,body===undefined?{headers:cookie?{Cookie:cookie}:{}}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const data=await response.json();return {response,data};
}
async function emailLink(route){
 for(let attempt=0;attempt<20;attempt++){
  const mailbox=await(await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
  for(const message of mailbox.messages || []){
   if(!message.To?.some(recipient=>recipient.Address===email))continue;
   mailIds.add(message.ID);
   const full=await(await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
   const text=((full.HTML || '')+'\n'+(full.Text || '')).replaceAll('&amp;','&');
   for(const candidate of text.match(/https?:\/\/[^\s"<>]+/g) || []){
    try{const url=new URL(candidate);if(url.origin===base && url.pathname===route && url.searchParams.get('email')===email && url.searchParams.get('token'))return url;}catch{}
   }
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error('Local confirmation/recovery email did not arrive');
}
try{
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  try{if((await fetch(base+'/account/login')).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.equal(ready,true,'isolated live storefront starts');
 for(const route of ['/account/login','/account/register','/account','/account/forgot','/account/confirm','/account/reset','/account.css','/account.js','/account-session.js','/assets/icons/user.svg'])assert.equal((await fetch(base+route)).status,200,route+' is served');
 assert.match(await(await fetch(base+'/?demo=1')).text(),/id="account-link"/);
 let result=await request('register',{email,password:oldPassword,firstName:'Тест',lastName:'Покупець'});
 assert.equal(result.response.status,201,'live registration succeeds');registered=true;
 if(result.data.requiresConfirmation){
  result=await request('login',{email,password:oldPassword});assert.equal(result.response.status,401,'unconfirmed customer cannot log in');
  const link=await emailLink('/account/confirm');
  result=await request('confirm',{email,token:link.searchParams.get('token'),password:oldPassword});
  assert.equal(result.response.status,200,'email confirmation succeeds');
 }
 result=await request('login',{email,password:oldPassword});assert.equal(result.response.status,200,'live login succeeds');
 assert.equal(result.data.token,undefined,'JWT is not returned to browser');
 let cookie=result.response.headers.get('Set-Cookie').split(';')[0];
 result=await request('me',undefined,cookie);assert.equal(result.data.user.email,email,'live authenticated profile works');
 result=await request('profile',{firstName:'Перевірено',lastName:'Покупець'},cookie);assert.equal(result.response.status,200,'profile updates succeed');
 result=await request('password-reset',{email});assert.equal(result.response.status,200,'recovery request succeeds');
 const recovery=await emailLink('/account/reset');
 result=await request('password-set',{email,token:recovery.searchParams.get('token'),password:newPassword},cookie);assert.equal(result.response.status,200,'password reset succeeds');
 result=await request('login',{email,password:oldPassword});assert.equal(result.response.status,401,'old password no longer works');
 // Saleor deliberately suspends the next attempt after a bad password.
 await new Promise(resolve=>setTimeout(resolve,1200));
 result=await request('login',{email,password:newPassword});
 if(result.response.status!==200)console.log('New password login response:',result.data.error || 'no public error');
 assert.equal(result.response.status,200,'new password works');
 cookie=result.response.headers.get('Set-Cookie').split(';')[0];
 result=await request('logout',{},cookie);assert.equal(result.response.status,200,'logout succeeds');
 result=await request('me',undefined,cookie);assert.equal(result.data.user,null,'logout clears the session');
 console.log('Live Saleor verified: customer registration, confirmation via local Mailpit, login, profile, recovery, new password, logout, and all account routes.');
}finally{
 child.kill();
 if(registered)await python(`import json,sys
from saleor.account.models import User
data=json.load(sys.stdin)
assert data['email'].startswith('qa-customer-') and data['email'].endswith('@vsmarket.invalid')
user=User.objects.filter(email=data['email']).first()
if user:
 assert not user.is_staff and not user.is_superuser
 user.delete()
print('Temporary test customer removed')`,{email});
 if(mailIds.size){
  const cleanup=await fetch('http://127.0.0.1:8025/api/v1/messages',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:[...mailIds]})});
  if(!cleanup.ok)throw new Error('Temporary test email cleanup failed');
 }
}
