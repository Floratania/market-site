const spec=(p,key)=>p.specifications?.find(s=>s.key===key);
const norm=value=>String(value||'').trim().toLocaleLowerCase('uk');
export function recommendationSettings(metadata=[]){
 try{const value=JSON.parse(metadata.find(m=>m.key==='storefront_recommendations')?.value||'{}');return {cross:Array.isArray(value.cross)?value.cross:[],upsell:Array.isArray(value.upsell)?value.upsell:[]};}catch{return {cross:[],upsell:[]};}
}
export function recommendationsFor(product,products){
 const settings=product.recommendationSettings||{cross:[],upsell:[]},bySku=new Map(products.map(p=>[p.sku,p]));
 const eligible=p=>p&&p.id!==product.id&&p.active!==false&&Number.isFinite(p.price)&&p.price>0&&(p.availableTotal==null||p.availableTotal>0);
 const linked=(rows,kind)=>rows.filter(r=>r&&typeof r.sku==='string').map(r=>({p:bySku.get(r.sku),reason:String(r.reason||'').slice(0,300),verified:r.verified===true})).filter(r=>eligible(r.p)&&r.reason&&(kind!=='upsell'||r.p.price>product.price)&&(kind!=='cross'||r.verified)).map(r=>({sku:r.p.sku,reason:r.reason,source:'manual'}));
 const cross=linked(settings.cross,'cross'),upsell=linked(settings.upsell,'upsell');
 const doorKind=norm(spec(product,'construction_kind')?.value),doorType=norm(spec(product,'product_type')?.value);
 const screenCandidate=product.category==='Двері'&&doorKind.includes('пвх')&&(/стандарт|standart|інкрустація/.test(doorType));
 const related=screenCandidate?products.filter(p=>p.category==='Москітні сітки'&&eligible(p)).slice(0,1).map(p=>({sku:p.sku,reason:'Дверна москітна сітка. Розміри та спосіб кріплення уточнить менеджер.',source:'category'})):[];
 const similar=products.filter(p=>eligible(p)&&p.productId!==product.productId&&p.category===product.category&&['width','height','product_type'].every(key=>{const a=spec(product,key),b=spec(p,key);return a&&b&&norm(a.value)===norm(b.value)&&norm(a.unit)===norm(b.unit);})).sort((a,b)=>Math.abs(a.price-product.price)-Math.abs(b.price-product.price)).slice(0,3).map(p=>({sku:p.sku,reason:'Ті самі тип і розміри. Порівняйте оздоблення та комплектацію.',source:'attributes'}));
 // Automatic candidates must match both dimensions and the construction type.
 const same=(p,key)=>{const a=spec(product,key),b=spec(p,key);return a&&b&&norm(a.value)===norm(b.value)&&norm(a.unit)===norm(b.unit);};
 if(!upsell.length&&spec(product,'width')&&spec(product,'height')&&spec(product,'product_type')){
  for(const p of products.filter(p=>eligible(p)&&p.price>product.price&&p.productId!==product.productId&&['width','height','product_type'].every(k=>same(p,k))&&['opening_direction','opening','material'].every(k=>!spec(product,k)||same(p,k))).sort((a,b)=>a.price-b.price)){
   const reasons=[];
   for(const key of ['profile_system','color','filling','equipment','lock','threshold']){
    const a=spec(product,key),b=spec(p,key);if(a&&b&&norm(a.value)!==norm(b.value))reasons.push(`${b.label}: ${b.value}${b.unit?' '+b.unit:''} (у вашому виборі — ${a.value}${a.unit?' '+a.unit:''})`);
   }
   for(const key of ['profile_thickness','glass_thickness','warranty']){
    const a=spec(product,key),b=spec(p,key);if(a&&b&&a.unit&&norm(a.unit)===norm(b.unit)&&/^\d+(?:[.,]\d+)?$/.test(a.value)&&/^\d+(?:[.,]\d+)?$/.test(b.value)&&Number(b.value.replace(',','.'))>Number(a.value.replace(',','.')))reasons.push(`${b.label}: ${b.value} ${b.unit} замість ${a.value} ${a.unit}`);
   }
   if(reasons.length&&!upsell.some(r=>bySku.get(r.sku)?.productId===p.productId))upsell.push({sku:p.sku,reason:reasons.join(' · '),source:'attributes'});
   if(upsell.length>=3)break;
  }
 }
 return {cross:cross.slice(0,3),upsell:upsell.slice(0,3),related,similar};
}
export function decorateRecommendations(products){return products.map(p=>({...p,recommendations:recommendationsFor(p,products)}));}
