import fs from 'node:fs/promises';
const base='http://127.0.0.1:8790';
const credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
if((await fetch(base+'/api/manage/interest')).status!==401)throw new Error('Anonymous access not denied');
const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(credentials)});
if(!response.ok)throw new Error('Login failed');const cookie=response.headers.get('set-cookie').split(';')[0];
try{
 const r=await fetch(base+'/api/manage/interest',{headers:{Cookie:cookie}}),data=await r.json();
 if(!r.ok)throw new Error('Report failed: '+r.status+' '+data.error);
 console.log(JSON.stringify({reportAvailable:true,registered:data.registered,rankedVariants:data.ranking.length,anonymousDenied:true}));
 const users=await fetch(base+'/api/manage/users',{headers:{Cookie:cookie}}),customers=await users.json();if(!users.ok||!Array.isArray(customers.users))throw new Error('Customer list unavailable: '+customers.error);console.log(JSON.stringify({customerListAvailable:true,customers:customers.users.length}));
}finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:'{}'});}
