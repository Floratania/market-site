import fs from 'node:fs/promises';
const base='http://127.0.0.1:8790',credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
if((await fetch(base+'/api/manage/notification-settings')).status!==401)throw new Error('Secrets settings accessible anonymously');
const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(credentials)});if(!r.ok)throw new Error('Login failed');const cookie=r.headers.get('set-cookie').split(';')[0];
try{for(const route of ['settings','notification-settings']){const response=await fetch(base+'/api/manage/'+route,{headers:{Cookie:cookie}}),d=await response.json();if(!response.ok)throw new Error(route+' unavailable '+d.error);if(route==='notification-settings'&&(d.email.password||d.telegram.botToken))throw new Error('Secrets leaked');console.log(route+': OK');}
const site=await(await fetch(base+'/api/site')).json();if(!site.settings?.heroTitle)throw new Error('Public shop settings unavailable');
const asset=await fetch(base+'/assets/manage-settings.js?v=1');if(!asset.ok)throw new Error('Settings UI unavailable');console.log('Public content and admin script: OK');
}finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{}'});}
