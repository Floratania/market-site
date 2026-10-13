import fs from 'node:fs/promises';
const base='http://127.0.0.1:8790';
const credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
const anonymous=await fetch(base+'/api/manage/orders');
if(anonymous.status!==401)throw new Error('Anonymous management access was not denied');
const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});
if(!response.ok)throw new Error('Local administrator login failed');
const cookie=response.headers.get('set-cookie').split(';')[0];
try{
 for(const route of ['me','orders','catalog']){
  const result=await fetch(base+'/api/manage/'+route,{headers:{Cookie:cookie}}),data=await result.json();
  if(!result.ok)throw new Error('Management verification failed: '+route+' '+result.status+' '+data.error);
  console.log(route+': OK'+(data.products?' · '+data.products.length+' variants':data.records?' · '+data.records.length+' orders':''));
 }
}finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:'{}'});}
