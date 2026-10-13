import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root=new URL('./',import.meta.url);
const loginFile=new URL('pgadmin.local.json',root);
let login;
try { login=JSON.parse(await fs.readFile(loginFile,'utf8')); }
catch(error) {
  if(error.code!=='ENOENT')throw new Error('Cannot read pgadmin.local.json');
  login={url:'http://127.0.0.1:5050/',email:'pgadmin@vsmarket.example.com',password:crypto.randomBytes(24).toString('base64url')};
  await fs.writeFile(loginFile,JSON.stringify(login,null,2)+'\n',{flag:'wx'});
}
if(!login.email || !login.password || /[\r\n]/.test(login.email+login.password))throw new Error('Invalid local pgAdmin credentials');
await fs.writeFile(new URL('.env.pgadmin',root),`PGADMIN_DEFAULT_EMAIL=${login.email}\nPGADMIN_DEFAULT_PASSWORD=${login.password}\n`);
const backend=await fs.readFile(new URL('saleor-platform/backend.env',root),'utf8');
const databaseUrl=backend.split(/\r?\n/).find(line=>line.startsWith('DATABASE_URL='))?.slice('DATABASE_URL='.length);
const db=new URL(databaseUrl);
const passEscape=value=>value.replaceAll('\\','\\\\').replaceAll(':','\\:');
await fs.writeFile(new URL('.pgpass.saleor.local',root),[db.hostname,db.port||'5432',db.pathname.slice(1),decodeURIComponent(db.username),decodeURIComponent(db.password)].map(passEscape).join(':')+'\n');
console.log('Local pgAdmin configuration ready. Login details saved in pgadmin.local.json.');
