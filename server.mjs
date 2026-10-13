import {termsRoutes,termsPage} from './integration/store-terms.mjs';
import {websiteCommerce} from './integration/website-commerce.mjs';
import {buildQuote,paymentPreference,promoCode,paymentLabels} from './integration/checkout-pricing.mjs';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { specificationsFor } from './integration/catalog-specifications.mjs';
import { productDescription } from './integration/product-description.mjs';
import { createCustomerAuth } from './integration/customer-auth.mjs';
import { publicLocations } from './integration/site-locations.mjs';
import {shopSettings} from './integration/shop-settings.mjs';
import {variantPhotos,variantPromotion} from './integration/product-merchandising.mjs';
import {routingConfig,routingInfo,drivingRoutes,validateOrigin} from './integration/location-routes.mjs';
import { stockSnapshot } from './integration/stock-snapshot.mjs';
import { validateCustomDesign, customProductDescription, customLabels } from './integration/custom-product.mjs';
import {orderSettings} from './integration/order-settings.mjs';
import {novaCities,novaWarehouses,validateNovaDelivery} from './integration/nova-poshta.mjs';
import {createOrderStore} from './integration/order-store.mjs';
import {createManageApi} from './integration/manage-api.mjs';
import {manuallyDisabled} from './integration/product-activation.mjs';
import {customerOrders} from './integration/customer-orders.mjs';
import {commerceScheduler} from './integration/commerce-scheduler.mjs';
import {recommendationSettings,decorateRecommendations} from './integration/recommendations.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(path.join(root, '.env')); }
  catch(error) { if(error.code !== 'ENOENT') throw error; }
}
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 8790);
const channel = process.env.SALEOR_CHANNEL || 'default-channel';
const saleorUrl = process.env.SALEOR_GRAPHQL_URL || '';
const managerUrl = process.env.MANAGER_WEBHOOK_URL || '';
const inventoryUrl = process.env.INVENTORY_API_URL || '';
const stockMaxAge = Number(process.env.STOCK_MAX_AGE_SECONDS || 120) * 1000;
const locations = new Set(['mamaivtsi', 'magala']);
const rate = new Map();
const routeRate=new Map();
const publicUrl = process.env.STOREFRONT_PUBLIC_URL || `http://127.0.0.1:${port}`;
const customerAuth = createCustomerAuth({ saleorUrl, channel, publicUrl, json, readBody });
const websiteEnabled=process.env.WEBSITE_COMMERCE_ENABLED===undefined?port===8790:process.env.WEBSITE_COMMERCE_ENABLED!=='0';
const orderStore=createOrderStore({onStatusChange:websiteEnabled?(order,target)=>website.change(order,target):undefined,onSettle:websiteEnabled?(order,reference)=>website.settle(order,reference):undefined});
const manageApi=createManageApi({auth:customerAuth,orders:orderStore,catalog:account=>allProducts(account),json,readBody,publicUrl,sourcePrice,sourceDescription,channel,dashboardUrl:process.env.SALEOR_DASHBOARD_URL||'http://127.0.0.1:9000/'});
const notificationTimer=setInterval(()=>orderStore.flush().catch(()=>console.error('Order notification retry failed')),60000);
notificationTimer.unref();
orderStore.flush().catch(()=>console.error('Order notification retry failed'));
const deliveryRate=new Map();
const commerce=commerceScheduler(root,{enabled:process.env.CATALOG_AUTO_SYNC==='1'||(port===8790&&process.env.CATALOG_AUTO_SYNC!=='0')});

const PRODUCTS_QUERY = `query StoreProducts($channel: String!, $first: Int!, $after: String) {
  products(first: $first, after: $after, channel: $channel) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id name slug description
      thumbnail(size: 512) { url alt }
      category { id name slug }
      metadata { key value }
      variants {
        id name sku quantityAvailable
        media { id url alt }
        metadata { key value }
        pricing { price { gross { amount currency } } }
      }
    } }
  }
}`;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function saleor(query, variables) {
  if (!saleorUrl) throw Object.assign(new Error('Каталог ще не підключено'), { status: 503 });
  const response = await fetch(saleorUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Saleor HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((item) => item.message).join('; '));
  return payload.data;
}

const website=websiteCommerce({catalog:()=>allProducts(),refresh:()=>commerce.ensureFresh()});
async function withWebsiteAvailability(products){
 if(!websiteEnabled)return products;
 const snapshot=await website.snapshot(),held=new Map();for(const row of snapshot.items)held.set(row.sku,(held.get(row.sku)||0)+row.quantity);
 return products.map(p=>({...p,availableTotal:p.availableTotal==null?null:Math.max(0,p.availableTotal-(held.get(p.sku)||0))}));
}
async function allProducts(account) {
  const products = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const query=account?PRODUCTS_QUERY.replace('id name slug description','id name slug description privateMetadata{key value} channelListings{channel{slug} isPublished}'):PRODUCTS_QUERY;
    const data = await (account?account.graphql:saleor)(query, { channel, first: 100, after });
    if(account)for(const {node} of data.products?.edges||[])node.managementActive=node.channelListings?.find(item=>item.channel.slug===channel)?.isPublished===true&&!manuallyDisabled(node.privateMetadata,channel);
    products.push(...normalizeProducts(data));
    if (!data.products?.pageInfo?.hasNextPage) return decorateRecommendations(await withWebsiteAvailability(products));
    after = data.products.pageInfo.endCursor;
    if (!after) break;
  }
  throw new Error('Каталог завеликий для поточного завантаження');
}

async function sourcePrice(sku){
  try{
    if(sku==='НФ-00001746'){
      const mosquito=JSON.parse(await fs.readFile(path.join(root,'integration','mosquito-export.local.json'),'utf8'));
      const row=mosquito.catalogRows?.find(row=>String(row.Code||'').trim()===sku);
      return row?.PriceStatus==='candidate'&&Number(row.Price)>0?Number(row.Price):null;
    }
    try{
      const accessories=JSON.parse(await fs.readFile(path.join(root,'integration','valko-export.local.json'),'utf8'));
      const item=accessories.catalogRows?.find(row=>String(row.Code||'').trim()===sku&&row.VariantRef==='0x00000000000000000000000000000000');
      if(item)return item.PriceStatus==='candidate'&&Number(item.Price)>0?Number(item.Price):null;
    }catch(error){if(error.code!=='ENOENT')throw error;}
    const latest=JSON.parse(await fs.readFile(path.join(root,'integration','operational-export.local.json'),'utf8'));
    const row=latest.catalogRows?.find(row=>String(row.Code||'').trim()===sku);
    if(row)return row.PriceStatus==='candidate'&&Number(row.Price)>0?Number(row.Price):null;
  }catch(error){if(error.code!=='ENOENT')throw error;}
  let folders;try{folders=(await fs.readdir(path.join(root,'integration','exports'))).filter(name=>/^catalog-\d/.test(name)).sort().reverse();}catch(error){if(error.code==='ENOENT')return null;throw error;}
  if(!folders.length)return null;
  const data=JSON.parse(await fs.readFile(path.join(root,'integration','exports',folders[0],'catalog.local.json'),'utf8'));
  const value=data.catalogRows?.find(row=>String(row.Code||'').trim()===sku)?.Price;
  return value!=null&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
}

async function sourceDescription(sku){
  try{const data=JSON.parse(await fs.readFile(path.join(root,'integration','source-descriptions.local.json'),'utf8'));return data.items?.find(row=>row.sku===sku)?.description||'';}
  catch(error){if(error.code==='ENOENT')return '';throw error;}
}

function normalizeProducts(data) {
  return (data.products?.edges || []).flatMap(({ node }) => (node.variants || []).filter(variant=>node.managementActive!==undefined||variant.pricing?.price?.gross?.amount > 0).map((variant) => {
    const specifications = specificationsFor(node.metadata || [], variant.metadata || []);
    const value = key => specifications.find(item => item.key === key)?.value || '';
    return ({
    id: variant.id, productId: node.id, slug: node.slug, name: node.name,
    ...(node.managementActive!==undefined?{active:node.managementActive}:{}),
    description: productDescription(node.description),
    recommendationSettings:recommendationSettings(variant.metadata),
    variantName: variant.name, sku: variant.sku, category: node.category?.name || '',
    categoryId: node.category?.id || '', image: variantPhotos(variant)[0]?.url || (variant.metadata?.some(m=>m.key==='storefront_media_override'&&m.value)?'':node.variants.length===1 ? node.thumbnail?.url || '' : ''),
    imageAlt: variant.media?.[0]?.alt || node.thumbnail?.alt || node.name,
    media: variantPhotos(variant).map(image=>({id:image.id,url:image.url,alt:image.alt||node.name})),promotion:variantPromotion(variant),
    price: variant.pricing?.price?.gross?.amount ?? null,
    currency: variant.pricing?.price?.gross?.currency || 'UAH',
    availableTotal: variant.quantityAvailable ?? null,
    specifications, material: value('material'), opening: value('opening'),
    crossSellSkus: (node.metadata || []).find((item) => item.key === 'cross_sell_skus')?.value?.split(',').map((x) => x.trim()).filter(Boolean) || [],
    upsellSkus: (node.metadata || []).find((item) => item.key === 'upsell_skus')?.value?.split(',').map((x) => x.trim()).filter(Boolean) || [],
  }); }));
}

async function stockFor(skus) {
  if (!skus.length) return { items: [], verified: false };
  if (!inventoryUrl){
    const base=await stockSnapshot(path.join(root,'integration','saleor-import-stock.local.json'),skus);
    const mosquito=await stockSnapshot(path.join(root,'integration','mosquito-stock.local.json'),skus);
    const accessories=await stockSnapshot(path.join(root,'integration','valko-stock.local.json'),skus);
    let items=[...base.items,...mosquito.items,...accessories.items];
    if(websiteEnabled){const holds=await website.snapshot();items=items.map(item=>({...item,quantity:Math.max(0,item.quantity-[...holds.items,...(holds.nativeItems||[])].filter(r=>r.sku===item.sku&&r.location===item.location).reduce((sum,r)=>sum+r.quantity,0))}));}
    return {...base,items,snapshotAt:base.snapshotAt||mosquito.snapshotAt||accessories.snapshotAt};
  }
  const url = new URL(inventoryUrl);
  url.searchParams.set('skus', skus.join(','));
  const response = await fetch(url, {
    headers: process.env.INVENTORY_API_TOKEN ? { Authorization: `Bearer ${process.env.INVENTORY_API_TOKEN}` } : {},
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Inventory HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error('Invalid inventory response');
  const items = payload.items.filter((item) => skus.includes(item.sku) && locations.has(item.location));
  const seen = new Set();
  for (const item of items) {
    const age = Date.now() - Date.parse(item.updatedAt);
    const key = `${item.sku}:${item.location}`;
    if (!Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isFinite(age) || age < -30_000 || age > stockMaxAge || seen.has(key)) throw new Error('Unverified inventory response');
    seen.add(key);
  }
  return { items, verified: true };
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > (req.url==='/api/manage/shop-image'?1_800_000:100_000)) throw Object.assign(new Error('Завеликий запит'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Некоректні дані'), { status: 400 }); }
}

function validLead(body) {
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const comment = String(body.comment || '').trim();
  if(!['pickup','manager','nova_poshta'].includes(body.delivery))throw Object.assign(new Error('Оберіть спосіб отримання'),{status:400});
  const delivery = body.delivery;
  const location = delivery === 'pickup' && locations.has(body.location) ? body.location : null;
  const lines = Array.isArray(body.lines) && body.lines.length <= 30 ? body.lines : [];
  if (name.length < 2 || name.length > 100 || !/^\+?[\d\s()\-]{9,25}$/.test(phone)||phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15) throw Object.assign(new Error('Перевірте ім’я та телефон'), { status: 400 });
  if (comment.length > 1000 || !lines.length || lines.some((line) => !line || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000 || (line.customDesign ? line.sku!=null : typeof line.sku !== 'string' || !line.sku.length || line.sku.length > 100))) throw Object.assign(new Error('Перевірте товари в кошику'), { status: 400 });
  if (delivery === 'pickup' && !location) throw Object.assign(new Error('Оберіть місце самовивозу'), { status: 400 });
  const email=String(body.email || '').trim();
  if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Object.assign(new Error('Перевірте email'),{status:400});
  const normalized=lines.map(line=>line.customDesign?{customDesign:validateCustomDesign(line.customDesign),quantity:line.quantity}:{sku:line.sku,quantity:line.quantity});
  const skus=normalized.filter(line=>line.sku).map(line=>line.sku);
  if(new Set(skus).size!==skus.length)throw Object.assign(new Error('У кошику повторюються товари'),{status:400});
  return { name, phone, email, comment, delivery, location, lines:normalized, paymentMethod:paymentPreference(body.paymentMethod,delivery).method, promoCode:promoCode(body.promoCode) };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if(req.method==='GET'&&termsRoutes.has(url.pathname)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(await termsPage(url.pathname));}
  if (await customerAuth.handle(req, res, url)) return;
  if (await manageApi(req,res,url)) return;
  if(req.method==='GET'&&url.pathname==='/api/account/orders'){
    try{const {user}=await customerAuth.requireUser(req,res);return json(res,200,{orders:customerOrders(await orderStore.list(),user.id)});}
    catch(error){return json(res,error.status||503,{error:error.status?error.message:'Не вдалося завантажити замовлення.'});}
  }
  if(req.method==='GET'&&url.pathname==='/api/checkout')return json(res,200,{acceptingOrders:await orderStore.ready(),phone:'+380 66 670 97 77',paymentMethods:paymentLabels,cardEnabled:false});
  if(req.method==='POST'&&url.pathname==='/api/quote'){
    if(req.headers.origin&&req.headers.origin!==new URL(publicUrl).origin)return json(res,403,{error:'Запит недоступний'});
    const ip='quote:'+String(req.socket.remoteAddress||'unknown'),now=Date.now(),recent=(rate.get(ip)||[]).filter(t=>now-t<60000);if(recent.length>=15)return json(res,429,{error:'Забагато розрахунків. Спробуйте за хвилину.'});rate.set(ip,[...recent,now]);
    const input=await readBody(req);if(Array.isArray(input.lines)&&input.lines.some(l=>!l.customDesign))await commerce.ensureFresh();
    return json(res,200,await buildQuote(input,await allProducts(),{channel}));
  }
  if(req.method==='GET'&&['/api/nova-poshta/cities','/api/nova-poshta/warehouses'].includes(url.pathname)){
    const now=Date.now(),key=req.socket.remoteAddress||'unknown';
    for(const [ip,times] of deliveryRate){const recent=times.filter(time=>now-time<60000);if(recent.length)deliveryRate.set(ip,recent);else deliveryRate.delete(ip);}
    const recent=deliveryRate.get(key)||[];
    if(recent.length>=90)return json(res,429,{error:'Забагато запитів. Спробуйте за хвилину.'});
    deliveryRate.set(key,[...recent,now]);
    const config=(await orderSettings()).novaPoshta||{};
    const items=url.pathname.endsWith('/cities')?await novaCities(url.searchParams.get('q'),config):await novaWarehouses(url.searchParams.get('cityRef'),url.searchParams.get('q'),config);
    return json(res,200,{items});
  }
  if(req.method==='GET'&&url.pathname==='/api/site'){
    const content=JSON.parse(await fs.readFile(path.join(root,'integration','site-content.json'),'utf8'));
    const socials=(content.socials||[]).filter(item=>{try{return typeof item.label==='string'&&item.label.length<=80&&new URL(item.url).protocol==='https:';}catch{return false;}}).slice(0,8).map(({label,url})=>({label,url}));
    const settings=await shopSettings();
    return json(res,200,{settings,socials:[['Facebook',settings.facebook],['Instagram',settings.instagram],['TikTok',settings.tiktok]].filter(([,url])=>url).map(([label,url])=>({label,url})),locations:publicLocations(content),routing:routingInfo(await routingConfig())});
  }
  if(req.method==='POST'&&url.pathname==='/api/location-routes'){
    if(req.headers.origin&&req.headers.origin!==new URL(publicUrl).origin)return json(res,403,{error:'Запит недоступний'});
    const origin=validateOrigin((await readBody(req)).origin),config=await routingConfig();
    if(!routingInfo(config).enabled)return json(res,503,{error:'Порівняння маршрутів тимчасово недоступне. Відкрийте маршрути в Google Maps.'});
    const now=Date.now(),key=req.socket.remoteAddress||'unknown';
    for(const [ip,times] of routeRate){const recent=times.filter(t=>now-t<3600000);if(recent.length)routeRate.set(ip,recent);else routeRate.delete(ip);}
    const recent=routeRate.get(key)||[];
    if(recent.length>=20)return json(res,429,{error:'Забагато розрахунків маршрутів. Спробуйте пізніше.'});
    routeRate.set(key,[...recent,now]);
    const content=JSON.parse(await fs.readFile(path.join(root,'integration','site-content.json'),'utf8'));
    try{return json(res,200,await drivingRoutes(origin,publicLocations(content),config));}
    catch{return json(res,503,{error:'Не вдалося порівняти маршрути. Оберіть точку вручну або спробуйте ще раз.'});}
  }
  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    let products = (await allProducts()).filter((item) => item.sku);
    const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('uk');
    const category = url.searchParams.get('category') || '';
    if (query) products = products.filter((item) => `${item.name} ${item.variantName} ${item.sku} ${item.specifications.map(spec => spec.value).join(' ')}`.toLocaleLowerCase('uk').includes(query));
    if (category) products = products.filter((item) => item.category === category);
    const stock = await stockFor(products.map((item) => item.sku)).catch(() => ({ items: [], verified: false }));
    return json(res, 200, { products, stock: stock.items, stockVerified: stock.verified, stockSnapshotAt: stock.snapshotAt || null });
  }
  if (req.method === 'POST' && ['/api/lead','/api/orders'].includes(url.pathname)) {
    if(req.headers.origin&&req.headers.origin!==url.origin&&req.headers.origin!==new URL(publicUrl).origin)return json(res,403,{error:'Запит недоступний'});
    const modern=url.pathname==='/api/orders';
    if (!modern&&!managerUrl) return json(res, 503, { error: 'Приймання замовлень тимчасово недоступне' });
    const key = String(req.socket.remoteAddress || 'unknown');
    const recent = (rate.get(key) || []).filter((time) => Date.now() - time < 3600_000);
    if (recent.length >= 5) return json(res, 429, { error: 'Забагато заявок. Спробуйте пізніше.' });
    const raw=await readBody(req),body = validLead(raw);
    if(modern&&raw.consent!==true)return json(res,400,{error:'Підтвердьте згоду на обробку замовлення'});
    const owner=modern?await customerAuth.optionalUser(req,res):null;
    const input={...body,shipping:body.delivery==='nova_poshta'?raw.shipping:null,...(owner?{customerId:owner.id}:{})};
    if(modern){const previous=await orderStore.find(raw.requestId,input);if(previous)return json(res,200,{id:previous.order.id});if(!await orderStore.ready())return json(res,503,{error:'Оформлення тимчасово недоступне. Зателефонуйте нам: +380 66 670 97 77.'});}
    // A server-side lookup prevents browser-supplied names and prices from entering the manager lead.
    if(body.lines.some(line=>!line.customDesign)){
      try{await commerce.ensureFresh();}catch{return json(res,503,{error:'Не вдалося перевірити актуальні ціни й наявність. Спробуйте пізніше або зателефонуйте нам.'});}
    }
    const products = new Map((body.lines.some(line=>!line.customDesign)?await allProducts():[]).map((item) => [item.sku, item]));
    const lines = body.lines.map((line) => ({ ...line, product: line.customDesign?null:products.get(line.sku) }));
    if (lines.some((line) => !line.customDesign&&!line.product)) return json(res, 409, { error: 'Один із товарів більше не доступний у каталозі' });
    if(lines.some(line=>!line.customDesign&&raw.lines.find(item=>item.sku===line.sku)?.expectedPrice!==undefined&&raw.lines.find(item=>item.sku===line.sku).expectedPrice!==line.product.price))return json(res,409,{error:'Ціна товару оновилася. Оновіть сторінку оформлення, перегляньте суму й підтвердьте замовлення ще раз.'});
    if(commerce.enabled&&body.delivery!=='pickup'){
      const stock=await stockFor(lines.filter(line=>!line.customDesign).map(line=>line.sku));
      if(lines.some(line=>!line.customDesign&&stock.items.filter(item=>item.sku===line.sku).reduce((sum,item)=>sum+item.quantity,0)<line.quantity))return json(res,409,{error:'Для частини товарів недостатньо залишку. Зменште кількість або зателефонуйте нам.'});
    }
    if (body.delivery === 'pickup') {
      if(lines.some(line=>line.customDesign))return json(res,409,{error:'Для індивідуального виробу оберіть отримання за погодженням із менеджером.'});
      const stock = await stockFor(lines.map((line) => line.sku));
      if ((!modern&&!stock.verified) || ((stock.verified||commerce.enabled)&&lines.some((line) => Number(stock.items.find((item) => item.sku === line.sku && item.location === body.location)?.quantity || 0) < line.quantity))) {
        return json(res, 409, { error: 'Наявність для самовивозу змінилася. Перевірте кошик.' });
      }
    }
    const pricing=await buildQuote({...body,lines:body.lines},[...products.values()],{channel});
    if(raw.expectedDiscount!==undefined&&raw.expectedDiscount!==pricing.discount)return json(res,409,{error:'Знижка змінилася. Застосуйте промокод повторно та перевірте суму.'});
    const payment=paymentPreference(body.paymentMethod,body.delivery);
    const shipping=body.delivery==='nova_poshta'?await validateNovaDelivery(raw.shipping,(await orderSettings()).novaPoshta||{}):null;
    const lead = { id: modern?raw.requestId:crypto.randomUUID(), createdAt: new Date().toISOString(), channel: 'website', customer: { name: body.name, phone: body.phone, email:body.email }, delivery: body.delivery, location: body.location, shipping, comment: body.comment, payment, pricing:{subtotal:pricing.subtotal,discount:pricing.discount,total:pricing.total,promotion:pricing.promotion,hasUnpriced:pricing.hasUnpriced},
      lines: lines.map((line) => line.customDesign?{sku:null,quantity:line.quantity,name:`${customLabels.kind[line.customDesign.kind]} за індивідуальними розмірами`,variantName:customProductDescription(line.customDesign),unitPrice:null,currency:'UAH',customDesign:line.customDesign}:{ sku: line.sku, quantity: line.quantity, name: line.product.name, variantName: line.product.variantName, unitPrice: line.product.price, currency: line.product.currency }) };
    if(modern){if(owner)lead.customerId=owner.id;lead.status='received';for(const [i,line] of lead.lines.entries()){if(lines[i].product)line.productUrl='/products/'+encodeURIComponent(lines[i].product.slug)+'?variant='+encodeURIComponent(lines[i].product.id);}const result=await orderStore.submit(lead,input);if(!result.replayed)rate.set(key,[...recent,Date.now()]);orderStore.flush().catch(()=>console.error('Order notification retry failed'));return json(res,result.replayed?200:201,{id:result.id});}
    const response = await fetch(managerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': lead.id, ...(process.env.MANAGER_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.MANAGER_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify(lead), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Manager webhook HTTP ${response.status}`);
    rate.set(key, [...recent, Date.now()]);
    return json(res, 201, { id: lead.id });
  }
  if (req.method !== 'GET' || url.pathname.includes('..')) return json(res, 404, { error: 'Не знайдено' });
  if(url.searchParams.has('demo')){url.searchParams.delete('demo');res.writeHead(302,{Location:url.pathname+(url.searchParams.size?'?'+url.searchParams:'')});return res.end();}
  const productRoute = /^\/products\/([^/]+)\/?$/.exec(url.pathname);
  let pageProduct, pageStatus = 200;
  if (productRoute) {
    let slug;
    try { slug = decodeURIComponent(productRoute[1]); } catch { return json(res,400,{error:'Некоректне посилання'}); }
    if (!url.searchParams.has('demo')) {
      let aliases=[];try{aliases=JSON.parse(await fs.readFile(path.join(root,'integration','model-product-aliases.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      const alias=aliases.find(item=>item.sourceSlug===slug);
      if(alias){const params=new URLSearchParams(url.searchParams);params.set('variant',alias.variantId);res.writeHead(302,{Location:`/products/${encodeURIComponent(alias.modelSlug)}?${params}`,'Cache-Control':'no-store'});return res.end();}
    }
    const products = url.searchParams.has('demo') ? JSON.parse(await fs.readFile(path.join(publicRoot,'catalog-demo.json'),'utf8')).map(row=>({id:row[0],slug:row[0],name:row[1],variantName:row[7]})) : (await allProducts()).filter(item=>item.sku);
    const variantId = url.searchParams.get('variant');
    pageProduct = products.find(item=>(item.slug || item.id) === slug && (!variantId || item.id === variantId));
    if (!pageProduct) pageStatus = 404;
  }
  const accountRoutes = new Set(['/account', '/account/', '/account/orders', '/account/login', '/account/register', '/account/confirm', '/account/forgot', '/account/reset']);
  const accountRoute = accountRoutes.has(url.pathname);
  const catalogRoute=['/catalog','/catalog/'].includes(url.pathname);
  const proposalRoute=['/proposal','/proposal/'].includes(url.pathname);
  const checkoutRoute=['/checkout','/checkout/'].includes(url.pathname);
  const manageRoute=['/manage','/manage/'].includes(url.pathname);
  const file = manageRoute ? 'manage.html' : accountRoute ? 'account.html' : url.pathname === '/' || productRoute || catalogRoute || checkoutRoute || proposalRoute ? 'index.html' : url.pathname.slice(1);
  const asset = /^assets\/[a-z0-9-]+\.(png|woff2|ttf|css)$/.test(file) || /^assets\/icons\/[a-z0-9-]+\.svg$/.test(file) || ['assets/manage-settings.js','assets/shop-content.js'].includes(file) || /^assets\/uploads\/[0-9a-f-]{36}\.(png|jpg)$/.test(file);
  if (!asset && !['manage-filters.js', 'manage-editor.js', 'manage.html', 'manage.js', 'index.html', 'app.js', 'checkout.js', 'proposal.js', 'home.js', 'home-discovery.js', 'locations.js', 'page-utilities.js', 'customer-selections.js', 'account.html', 'account.js', 'account-session.js', 'account.css', 'catalog-demo.json', 'styles.css', 'showroom.css', 'product-media.css', 'brand.css', 'logo.jpg', 'logo.png', 'brand-icon.svg'].includes(file)) return json(res, 404, { error: 'Не знайдено' });
  let bytes = await fs.readFile(path.join(publicRoot, file));
  if(proposalRoute)bytes=Buffer.from(bytes.toString('utf8').replace('<div id="home-page">','<div id="home-page" hidden>').replace('</main>',(await fs.readFile(path.join(publicRoot,'proposal-content.html'),'utf8'))+'\n</main>').replace('<title>VS Market — вікна та двері</title>','<title>Комерційна пропозиція — VS Market</title>').replace('</head>','<link rel="stylesheet" href="/assets/proposal.css?v=20261012-logo5"><script src="/proposal.js?v=20261012-totals4" defer></script></head>'));
  if(checkoutRoute)bytes=Buffer.from(bytes.toString('utf8').replace('<div id="home-page">','<div id="home-page" hidden>').replace('</main>',(await fs.readFile(path.join(publicRoot,'checkout-content.html'),'utf8'))+'\n</main>').replace('<title>VS Market — вікна та двері</title>','<title>Оформлення замовлення — VS Market</title>').replace('</head>','<link rel="stylesheet" href="/assets/checkout.css?v=20261012-payments1"><script src="/checkout.js?v=20261012-payments1" defer></script></head>'));
  if(catalogRoute)bytes=Buffer.from(bytes.toString('utf8').replace('<div id="home-page">','<div id="home-page" hidden>').replace('id="catalog" aria-labelledby="catalog-title" hidden','id="catalog" aria-labelledby="catalog-title"').replace('<title>VS Market — вікна та двері</title>','<title>Каталог вікон та дверей — VS Market</title>'));
  if (productRoute) {
    const escape = value => String(value || '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const title = pageProduct ? `${pageProduct.name} — VS Market` : 'Товар не знайдено — VS Market';
    const description = pageProduct ? pageProduct.description || pageProduct.variantName || pageProduct.name : 'Цього товару немає в каталозі VS Market.';
    bytes = Buffer.from(bytes.toString('utf8').replace(/<title>[^<]*<\/title>/,`<title>${escape(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${escape(description.slice(0,300))}">`));
    bytes = Buffer.from(bytes.toString('utf8').replace('<div id="home-page">','<div id="home-page" hidden>').replace('class="product-page" aria-labelledby="product-title" hidden>','class="product-page" aria-labelledby="product-title">'));
  }
  if (accountRoute) {
    const titles = {'/account/register':'Реєстрація','/account/login':'Вхід','/account/confirm':'Підтвердження адреси','/account/forgot':'Відновлення пароля','/account/reset':'Новий пароль'};
    bytes = Buffer.from(bytes.toString('utf8').replace('<title>Мій кабінет — VS Market</title>', `<title>${titles[url.pathname] || 'Мій кабінет'} — VS Market</title>`));
  }
  const types = { 'manage.html':'text/html', 'index.html': 'text/html', 'account.html':'text/html', 'account.js':'text/javascript', 'account-session.js':'text/javascript', 'customer-selections.js':'text/javascript', 'app.js': 'text/javascript', 'home.js':'text/javascript', 'styles.css': 'text/css', 'brand.css': 'text/css', 'logo.jpg': 'image/jpeg', 'logo.png': 'image/png', 'brand-icon.svg': 'image/svg+xml' };
  const mime = types[file] || ({'.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.css':'text/css','.json':'application/json'}[path.extname(file)]);
  res.writeHead(pageStatus, { 'Content-Type': mime + (mime.startsWith('text/') ? '; charset=utf-8' : ''), 'X-Content-Type-Options': 'nosniff', ...(file==='index.html' || accountRoute || manageRoute ? {'Cache-Control':'no-store'} : {}), ...(accountRoute ? {'Referrer-Policy':'no-referrer'} : {}) });
  res.end(bytes);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
http.createServer((req, res) => handle(req, res).catch((error) => {
  console.error('Storefront error:', error);
  json(res, error.status || 503, { error: error.status ? error.message : 'Сервіс тимчасово недоступний' });
})).listen(port, '127.0.0.1', () => console.log(`VS Market storefront: http://127.0.0.1:${port}`));
