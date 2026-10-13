import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
export function commerceScheduler(root,{enabled=false,interval=900000}={}){
 let running=null;
 const run=script=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[script],{cwd:root,windowsHide:true,stdio:'ignore'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Оновлення каталогу не завершилось. Спробуйте пізніше.')));
 });
 const refresh=()=>{
  if(!enabled)return Promise.resolve();
  if(running)return running;
  running=(async()=>{
   const child=spawn(process.execPath,['integration/export-catalog.mjs','--operational'],{cwd:root,windowsHide:true,stdio:'ignore'});
   await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Джерело цін і залишків недоступне.')));});
   await run('integration/refresh-commerce.mjs');
   const mosquito=spawn(process.execPath,['integration/export-mosquito-catalog.mjs'],{cwd:root,windowsHide:true,stdio:'ignore'});
   await new Promise((resolve,reject)=>{mosquito.on('error',reject);mosquito.on('exit',code=>code===0?resolve():reject(new Error('Оновлення москітної сітки не завершилось.')));});
   await run('integration/import-mosquito-catalog.mjs');
   await run('integration/export-valko-catalog.mjs');
   await run('integration/import-valko-catalog.mjs');
  })().finally(()=>{running=null;});return running;
 };
 const ensureFresh=async()=>{
  if(!enabled)return;
  if(running){await running;return;}
  let snapshot;try{snapshot=JSON.parse(await fs.readFile(path.join(root,'integration','saleor-import-stock.local.json'),'utf8'));}catch{}
  if(!snapshot||Date.now()-Date.parse(snapshot.updatedAt)>120000||!Number.isFinite(Date.parse(snapshot.updatedAt)))await refresh();
 };
 if(enabled){const timer=setInterval(()=>refresh().catch(()=>console.error('Catalog refresh failed; previous snapshot retained')),interval);timer.unref();refresh().catch(()=>console.error('Catalog refresh failed; previous snapshot retained'));}
 return {refresh,ensureFresh,enabled};
}
