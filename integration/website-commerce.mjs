import fs from 'node:fs/promises';import {spawn} from 'node:child_process';import {buildQuote} from './checkout-pricing.mjs';
export async function commerceCommand(input){
 const script=await fs.readFile(new URL('website-commerce.py',import.meta.url),'utf8');
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','-c',script],{cwd:new URL('../',import.meta.url),windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',done=false;const timer=setTimeout(()=>{child.kill();reject(Object.assign(new Error('Резервування не завершилось. Повторіть дію.'),{status:503}));},45000);
  child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',()=>{});child.on('error',()=>{clearTimeout(timer);reject(Object.assign(new Error('Сервіс резервування недоступний.'),{status:503}));});child.on('exit',()=>{clearTimeout(timer);if(done)return;done=true;try{const line=output.split('\n').find(l=>l.startsWith('VSMARKET_RESULT:')),result=JSON.parse(line.slice(16));if(!result.ok)throw Object.assign(new Error(result.error),{status:result.status});resolve(result.data);}catch(error){reject(error.status?error:Object.assign(new Error('Сервіс резервування недоступний.'),{status:503}));}});child.stdin.end(JSON.stringify(input));
 });
}
export function websiteCommerce({catalog,refresh,command=commerceCommand,quote=buildQuote}={}){
 let cached=null,cachedAt=0,running;
 const snapshot=async()=>{if(cached&&Date.now()-cachedAt<30000)return cached;if(running)return running;running=command({operation:'snapshot'}).then(value=>{cached=value;cachedAt=Date.now();return value;}).finally(()=>{running=null;});return running;};
 const change=async(order,target)=>{
  if(['received','cancelled'].includes(target)){if(order.commerce&&!order.commerce.released&&['shipped','completed'].includes(order.status))throw Object.assign(new Error('Після відправлення скасування потребує оформлення повернення товарів.'),{status:409});const released=await command({operation:'release',order});cached=null;return {commerce:released,pricing:order.pricing?{...order.pricing,promotion:order.pricing.promotion?{...order.pricing.promotion,confirmation:'released'}:null}:order.pricing};}
  if(!['confirmed','shipped','completed'].includes(target))return {};
  if(target!=='confirmed'&&['received','cancelled'].includes(order.status||'received'))throw Object.assign(new Error('Спочатку підтвердьте замовлення, щоб зарезервувати товари.'),{status:409});
  if(order.commerce&&!order.commerce.released)return {};
  const previous=await command({operation:'lookup',id:order.id});
  if(previous&&!previous.released){cached=null;return {commerce:previous,pricing:previous.pricing||order.pricing};}
  await refresh();
  const code=order.pricing?.promotion?.code||'',prepared=await command({operation:'prepare',code});
  const products=await catalog(),result=await quote({lines:order.lines.map(l=>l.customDesign?{customDesign:l.customDesign,quantity:l.quantity}:{sku:l.sku,quantity:l.quantity}),promoCode:code,email:order.customer.email},products);
  if(order.pricing&&result.total!==order.pricing.total||order.lines.some(l=>l.sku&&products.find(p=>p.sku===l.sku)?.price!==l.unitPrice))throw Object.assign(new Error('Ціна або знижка змінилася. Потрібно погодити нову суму з покупцем.'),{status:409});
  const pricing={subtotal:result.subtotal,discount:result.discount,total:result.total,hasUnpriced:result.hasUnpriced,promotion:result.promotion?{...result.promotion,confirmation:'applied'}:null};
  const committed=await command({operation:'commit',order:{...order,pricing},voucherFingerprint:prepared.fingerprint});cached=null;
  return {commerce:committed,pricing};
 };
 const settle=async(order,reference)=>{if(!['shipped','completed'].includes(order.status))throw Object.assign(new Error('Узгодження обліку доступне після відправлення.'),{status:409});const result=await command({operation:'settle',order,reference});cached=null;return result;};
 return {snapshot,change,settle};
}
