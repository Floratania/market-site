const typeValue=product=>(product.specifications||[]).find(spec=>spec.key==='product_type')?.value||'';
const groups=[
 {label:'Вікна',hint:'Світло й комфорт для оселі',category:'Вікна',types:['Вікно'],icon:'window'},
 {label:'Двері з декором',hint:'Виразні деталі для вашого входу',category:'Двері',types:['Двері інкрустація'],icon:'door'},
 {label:'Стандартні двері',hint:'Готові розміри й різне оздоблення',category:'Двері',types:['Двері стандарт','Двері Standart+'],icon:'door'},
 {label:'Технічні двері',hint:'Для робочих і допоміжних приміщень',category:'Двері',types:['Двері технічні'],icon:'door'},
 {label:'Двері в квартиру',hint:'Металеві вхідні двері',category:'Двері',types:['Двері металеві в квартиру'],icon:'door'},
 {label:'Фасадні двері',hint:'Металеві двері для входу в будинок',category:'Двері',types:['Двері металеві фасадні'],icon:'door'},
];
export function shoppingDirections(products){
 return groups.flatMap(group=>{
  const members=products.filter(p=>p.category===group.category&&group.types.includes(typeValue(p)));
  const types=group.types.filter(type=>members.some(p=>typeValue(p)===type));
  const photo=members.find(p=>p.media?.[0]?.url||p.image);
  return members.length?[{...group,types,count:members.length,image:photo?.media?.[0]?.url||photo?.image||''}]:[];
 });
}
export function readyHighlights(products,stock,limit=4){
 if(!stock.verified&&!Number.isFinite(Date.parse(stock.snapshotAt)))return [];
 const available=new Set(stock.items.filter(s=>Number.isFinite(s.quantity)&&s.quantity>0&&['mamaivtsi','magala'].includes(s.location)).map(s=>s.sku));
 const candidates=products.filter(p=>Number.isFinite(p.price)&&p.price>0&&available.has(p.sku));
 const hasPhoto=p=>Boolean(p.media?.length||p.image);
 const ordered=[...candidates].sort((a,b)=>Number(hasPhoto(b))-Number(hasPhoto(a))||a.price-b.price||a.sku.localeCompare(b.sku));
 const selected=[],seen=new Set();
 const add=p=>{if(p&&!seen.has(p.productId||p.id)){selected.push(p);seen.add(p.productId||p.id);}};
 for(const type of ['Вікно','Двері технічні','Двері металеві в квартиру','Двері стандарт']){if(selected.length<limit)add(ordered.find(p=>typeValue(p)===type&&!seen.has(p.productId||p.id)));}
 for(const p of ordered){if(selected.length>=limit)break;add(p);}
 return selected;
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const countLabel=count=>`${count} ${count%100>=11&&count%100<=14?'комплектацій':count%10===1?'комплектація':count%10>=2&&count%10<=4?'комплектації':'комплектацій'}`;
export async function initDiscovery(shop,document){
 if(!shop||!document.querySelector('#home-directions'))return;
 await shop.ready;
 if(shop.isDemo)return;
 const settings=await fetch('/api/site',{cache:'no-store'}).then(r=>r.json()).then(d=>d.settings||{}).catch(()=>({}));
 const products=shop.products(),directions=shoppingDirections(products).map(g=>({...g,image:settings.directionImages?.[g.label]||g.image}));
 if(directions.length){
  document.querySelector('#home-directions-grid').innerHTML=directions.map((group,index)=>`<a class="home-direction" href="${escape(shop.catalogUrl(group.category,'',group.types))}">${group.image?`<span class="home-direction-photo"><img src="${escape(group.image)}" alt="${escape(group.label)}" loading="lazy"></span>`:''}<span class="home-direction-top"><img src="/assets/icons/${group.icon}.svg" class="ui-icon" alt=""><span>${String(index+1).padStart(2,'0')}</span></span><h3>${escape(group.label)}</h3><p>${escape(group.hint)}</p><span class="home-direction-bottom"><span>${countLabel(group.count)}</span><span aria-hidden="true">↗</span></span></a>`).join('');
  document.querySelector('#home-directions').hidden=false;
 }
 const stock=shop.stock(),chosen=(settings.featuredSkus||[]).map(sku=>products.find(p=>p.sku===sku)).filter(p=>p&&stock.items.some(s=>s.sku===p.sku&&s.quantity>0));
 const highlights=chosen.length?chosen:readyHighlights(products,stock);
 if(highlights.length){
  document.querySelector('#home-ready-grid').innerHTML=highlights.map(product=>shop.renderCard(product)).join('');
  const date=Number.isFinite(Date.parse(stock.snapshotAt))?new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'}).format(new Date(stock.snapshotAt)):'';
  document.querySelector('#home-ready-note').textContent=stock.verified?'Перед замовленням перевірте потрібну комплектацію та склад.':`Наявність оновлено ${date}. Актуальну наявність підтвердить менеджер.`;
  const all=new URL(shop.catalogUrl(),'http://localhost');all.searchParams.set('warehouse','any');
  document.querySelector('#home-ready-all').href=all.pathname+all.search;
  document.querySelector('#home-ready').hidden=false;
 }
 if(['#home-directions','#home-ready'].includes(location.hash)){
  const target=document.querySelector(location.hash);
  if(target&&!target.hidden)target.scrollIntoView({block:'start'});
 }
}
if(typeof document!=='undefined'&&location.pathname==='/')initDiscovery(globalThis.VSMarketShop,document).catch(()=>{});
