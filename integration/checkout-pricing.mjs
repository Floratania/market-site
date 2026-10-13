import crypto from 'node:crypto';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
import {validateCustomDesign,customProductDescription,customLabels} from './custom-product.mjs';
export const paymentLabels={bank_transfer:'Переказ за реквізитами',cod:'Післяплата Новою поштою',cash_pickup:'Оплата при самовивозі',manager:'Узгодити з менеджером'};
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function paymentPreference(value,delivery){
 const method=value||'manager';
 if(method==='card')throw fail(409,'Онлайн-оплату карткою ще не підключено. Оберіть інший спосіб.');
 if(!Object.hasOwn(paymentLabels,method)||method==='cash_pickup'&&delivery!=='pickup'||method==='cod'&&delivery!=='nova_poshta')throw fail(400,'Оберіть спосіб оплати відповідно до отримання.');
 return {method,label:paymentLabels[method],status:'unpaid'};
}
export function promoCode(value){if(value==null||value==='')return '';if(typeof value!=='string'||value.trim().length>100||/[\x00-\x1f]/.test(value))throw fail(400,'Перевірте промокод.');return value.trim();}
export async function promoPreview(code,lines,email,{api=localSaleor,adminToken=localAdminToken,channel='vs-market-ua'}={}){
 if(!code)return null;
 if(lines.some(l=>l.unitPrice==null))throw fail(400,'Промокод можна перевірити після розрахунку індивідуальних виробів.');
 let id;
 try{
  const created=await api('mutation QuoteCheckout($input:CheckoutCreateInput!){checkoutCreate(input:$input){checkout{id} errors{code}}}',{input:{channel,lines:lines.map(l=>({variantId:l.variantId,quantity:l.quantity})),...(email?{email}:{})}});
  if(created.checkoutCreate.errors.length||!created.checkoutCreate.checkout)throw fail(409,'Не вдалося перевірити промокод для цього кошика. Перевірте наявність і кількість товарів.');
  id=created.checkoutCreate.checkout.id;
  const applied=await api('mutation QuotePromo($id:ID!,$code:String!){checkoutAddPromoCode(id:$id,promoCode:$code){checkout{subtotalPrice{gross{amount currency}} voucherCode discountName} errors{code}}}',{id,code});
  if(applied.checkoutAddPromoCode.errors.length||!applied.checkoutAddPromoCode.checkout)throw fail(400,'Промокод не діє або не підходить до цього кошика.');
  const checkout=applied.checkoutAddPromoCode.checkout;
  if(!checkout.voucherCode)throw fail(400,'Цей код не є промокодом на знижку.');
  const subtotal=Math.round(lines.reduce((s,l)=>s+Math.round(l.unitPrice*100)*l.quantity,0))/100,total=Number(checkout.subtotalPrice.gross.amount);
  if(checkout.subtotalPrice.gross.currency!=='UAH'||!Number.isFinite(total)||total<0||total>subtotal)throw fail(409,'Розрахунок знижки змінився. Оновіть кошик.');
  const discount=Math.round((subtotal-total)*100)/100;
  if(discount<=0)throw fail(400,'Промокод не дає знижки для цих товарів.');
  return {code:checkout.voucherCode,name:checkout.discountName||'Промокод',discount,total,confirmation:'manager'};
 }finally{
  if(id)try{const cleaned=await api('mutation QuoteCleanup($id:ID!){checkoutDelete(id:$id){errors{code}}}',{id},await adminToken());if(cleaned.checkoutDelete?.errors.length)throw new Error('Cleanup rejected');}catch{console.error('Temporary promo checkout cleanup failed');}
 }
}
export async function buildQuote(input,products,options={}){
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>30)throw fail(400,'Додайте товари до кошика.');
 const bySku=new Map(products.map(p=>[p.sku,p])),seen=new Set();
 const lines=input.lines.map(line=>{
  if(!line||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>1000)throw fail(400,'Перевірте кількість товарів.');
  if(line.customDesign){const design=validateCustomDesign(line.customDesign);return {sku:null,name:customLabels.kind[design.kind]+' за індивідуальними розмірами',variantName:customProductDescription(design),quantity:line.quantity,unitPrice:null,currency:'UAH'};}
  if(typeof line.sku!=='string'||seen.has(line.sku))throw fail(400,'Перевірте товари в кошику.');seen.add(line.sku);
  const p=bySku.get(line.sku);if(!p||p.active===false||!Number.isFinite(p.price)||p.price<=0)throw fail(409,'Товар більше не доступний у каталозі.');
  return {sku:p.sku,variantId:p.id,name:p.name,variantName:p.variantName||'',image:p.image||'',imageAlt:p.imageAlt||p.name,quantity:line.quantity,unitPrice:p.price,currency:'UAH',productUrl:'/products/'+encodeURIComponent(p.slug)+'?variant='+encodeURIComponent(p.id)};
 });
 const code=promoCode(input.promoCode),email=String(input.email||'').trim();if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw fail(400,'Перевірте email для промокоду.');
 const subtotal=Math.round(lines.reduce((s,l)=>s+Math.round((l.unitPrice||0)*100)*l.quantity,0))/100;
 const promotion=await promoPreview(code,lines,email,options);
 return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),lines,subtotal,discount:promotion?.discount||0,total:promotion?.total??subtotal,promotion,hasUnpriced:lines.some(l=>l.unitPrice==null)};
}
