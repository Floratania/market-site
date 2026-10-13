import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Only the existing local Docker project is addressed; credentials travel over stdin.
const base=new URL('./',import.meta.url);
const file=new URL('saleor-admin.local.json',base);
let credentials;
try {credentials=JSON.parse(await fs.readFile(file,'utf8'));}
catch(error) {
  if(error.code!=='ENOENT')throw new Error('Cannot read existing local admin credentials');
  credentials={email:'admin@vsmarket.local',password:crypto.randomBytes(24).toString('base64url'),url:'http://127.0.0.1:9000/'};
  await fs.writeFile(file,JSON.stringify(credentials,null,2)+'\n',{flag:'wx',mode:0o600});
}
if(!credentials.email || !credentials.password)throw new Error('Incomplete local admin credentials');
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const script=`import json,sys,os
from saleor.account.models import User
from django.db import transaction
from django.core.management import call_command
data=json.load(sys.stdin)
with transaction.atomic():
 user=User.objects.filter(email=data['email']).first()
 if user is not None:
  if not (user.is_active and user.is_staff and user.is_superuser and user.check_password(data['password'])):
   raise RuntimeError('Existing account was not modified; local credential verification failed')
  print('Local administrator verified; existing account unchanged')
 elif User.objects.filter(is_staff=True,is_active=True).exists():
  raise RuntimeError('Existing staff accounts found; no new administrator created')
 else:
  os.environ['DJANGO_SUPERUSER_PASSWORD']=data['password']
  call_command('createsuperuser',email=data['email'],interactive=False)
  print('Local administrator created')
`;
await new Promise((resolve,reject)=>{
 const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{cwd:base,stdio:['pipe','inherit','inherit'],windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
 child.stdin.end(JSON.stringify({email:credentials.email,password:credentials.password}));
 child.on('error',()=>reject(new Error('Local Docker account creation failed')));
 child.on('exit',code=>code===0?resolve():reject(new Error(`Account setup exited ${code}`)));
});
const response=await fetch('http://127.0.0.1:8000/graphql/',{
 method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
 body:JSON.stringify({query:'mutation Login($email:String!,$password:String!){tokenCreate(email:$email,password:$password){token errors{code} user{isStaff}}}',variables:{email:credentials.email,password:credentials.password}})
});
const result=await response.json();
if(!response.ok || result.errors?.length || !result.data?.tokenCreate?.token || result.data.tokenCreate.errors?.length || result.data.tokenCreate.user?.isStaff!==true) {
 throw new Error('Local GraphQL login verification failed; credentials are not logged');
}
console.log('Saleor login verified through GraphQL. Credentials saved only in saleor-admin.local.json.');
