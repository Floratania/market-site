const $ = (selector) => document.querySelector(selector);
const state = { products: [], stock: [], stockVerified: false, stockSnapshotAt: null, cart: {}, search: '', category: '', facets: {category: [], material: [], opening: []}, sort: 'default', demo: new URLSearchParams(location.search).has('demo'), activeProduct: null };
const onProductPage = new URL(location.href).pathname.startsWith('/products/');
const onCatalogPage = /^\/catalog\/?$/.test(new URL(location.href).pathname);
const onCheckoutPage = /^\/(?:checkout|proposal)\/?$/.test(new URL(location.href).pathname);
state.search = new URLSearchParams(location.search).get('q')?.trim().toLocaleLowerCase('uk') || '';
state.customCart = {};
const stockLocations={any:'Будь-який склад',mamaivtsi:'Мамаївці',magala:'Магала'};
const requestedWarehouse=new URLSearchParams(location.search).get('warehouse')||'';
state.stockLocation=Object.hasOwn(stockLocations,requestedWarehouse)?requestedWarehouse:'';
state.category = new URLSearchParams(location.search).get('category') || '';
state.facets['spec:product_type']=[...new Set(new URLSearchParams(location.search).getAll('type').map(value=>value.trim()).filter(value=>value&&value.length<=160))].slice(0,20);
const cartStore = 'vs-market-cart-v1';
const money = (amount, currency = 'UAH') => amount == null ? 'Ціну уточнить менеджер' : new Intl.NumberFormat('uk-UA', { style: 'currency', currency, minimumFractionDigits:0, maximumFractionDigits: 2 }).format(amount);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const imageUrl = (value) => { if(typeof value!=='string'||!value.trim())return '';try { const url = new URL(value.trim(), location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const byId = (id) => state.products.find((item) => item.id === id);
const bySku = (sku) => state.products.find((item) => item.sku === sku);
const cartLines = () => [...Object.entries(state.cart).map(([id, quantity]) => ({ product: byId(id), quantity })),...Object.entries(state.customCart).map(([id,item])=>({product:customCartProduct(id,item.design),quantity:item.quantity}))].filter((line) => line.product && line.quantity > 0);
const stockAt = (sku, locationKey) => state.stock.find((item) => item.sku === sku && item.location === locationKey);
const listStore = `vs-market-selections-v1${state.demo ? '-demo' : ''}`;
const selections = { favorites: [], comparison: [] };
const heartIcon = '<svg class="selection-icon heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const compareIcon = '<svg class="selection-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m8 10V4m8 16V7M2 20h20"/></svg>';
let selectionNoticeTimer;
function selectionNotice(message) {
  const status=$('#selection-status');status.textContent=message;status.hidden=false;
  document.querySelectorAll('.selection-inline-notice').forEach(note=>{note.textContent=message;note.hidden=false;});
  if(typeof clearTimeout==='function')clearTimeout(selectionNoticeTimer);
  if(typeof setTimeout==='function')selectionNoticeTimer=setTimeout(()=>{status.hidden=true;document.querySelectorAll('.selection-inline-notice').forEach(note=>{note.hidden=true;});},3500);
}
function loadSelections() {
  if(!state.demo && globalThis.VSMarketSelections){Object.assign(selections,globalThis.VSMarketSelections.value());return;}
  try {
    const saved=JSON.parse(localStorage.getItem(listStore)||'{}');
    for(const key of ['favorites','comparison'])if(Array.isArray(saved?.[key]))selections[key]=[...new Set(saved[key].filter(id=>typeof id==='string'&&id.length>0&&id.length<200))].slice(0,key==='comparison'?4:250);
  } catch { /* Ignore corrupt browser-local selections. */ }
}
function selectionButton(product,key) {
  const active=selections[key].includes(product.id),favorite=key==='favorites';
  const text=favorite?(active?'Збережено':'В улюблені'):(active?'У порівнянні':'Порівняти');
  return `<button type="button" class="selection-button" data-${favorite?'favorite':'compare'}="${escapeHtml(product.id)}" aria-pressed="${active}" aria-label="${escapeHtml(`${active?'Прибрати з':'Додати до'} ${favorite?'улюблених':'порівняння'}: ${product.name} · ${product.sku}`)}">${favorite?heartIcon:compareIcon}<span>${text}</span></button>`;
}
function selectionControls(product) { return `<div class="product-selections">${selectionButton(product,'favorites')}${selectionButton(product,'comparison')}</div>`; }
function toggleSelection(key,id) {
  if(!state.demo && globalThis.VSMarketSelections){
    if(!selections[key].includes(id)&&!byId(id))return;
    const result=globalThis.VSMarketSelections.toggle(key,id);
    if(result)selectionNotice(result);
    return;
  }
  const index=selections[key].indexOf(id);
  if(index>=0)selections[key].splice(index,1);
  else {
    if(!byId(id))return;
    if(selections[key].length>=(key==='comparison'?4:250)){selectionNotice(key==='comparison'?'Можна порівняти до 4 комплектацій. Приберіть одну, щоб додати іншу.':'Список улюблених заповнений. Приберіть товар, щоб додати інший.');return;}
    selections[key].push(id);
  }
  try {localStorage.setItem(listStore,JSON.stringify(selections));}
  catch {selectionNotice('Браузер не дозволяє зберегти вибір. Він залишиться до закриття сторінки.');}
  renderSelections();
}
function renderSelections() {
  $('#favorites-count').textContent=selections.favorites.length;
  $('#comparison-count').textContent=selections.comparison.length;
  for(const [key,attr] of [['favorites','favorite'],['comparison','compare']])document.querySelectorAll(`[data-${attr}]`).forEach(button=>{
    if(!button.classList.contains('selection-button'))return;
    const active=selections[key].includes(button.dataset[attr]);button.setAttribute('aria-pressed',String(active));
    button.innerHTML=(key==='favorites'?heartIcon:compareIcon)+`<span>${key==='favorites'?(active?'Збережено':'В улюблені'):(active?'У порівнянні':'Порівняти')}</span>`;
    const product=byId(button.dataset[attr]);if(product)button.setAttribute('aria-label',`${active?'Прибрати з':'Додати до'} ${key==='favorites'?'улюблених':'порівняння'}: ${product.name} · ${product.sku}`);
  });
  renderFavorites();renderComparison();
}
function unavailableSelections(key) {
  return selections[key].filter(id=>!byId(id)).map(id=>`<p class="notice">Збережений товар більше не доступний у каталозі. <button type="button" class="comparison-remove" data-${key==='favorites'?'favorite':'compare'}="${escapeHtml(id)}">Прибрати</button></p>`).join('');
}
function renderFavorites() {
  const items=selections.favorites.map(byId).filter(Boolean);
  $('#favorites-content').innerHTML=unavailableSelections('favorites')+(items.length?`<div class="favorites-grid">${items.map(card).join('')}</div>`:selections.favorites.length?'':'<p class="empty-grid">Поки немає улюблених товарів. Натисніть сердечко біля потрібної комплектації.</p>');
}
function comparisonRows(products) {
  const specs=new Map([['width','Ширина'],['height','Висота'],['opening_direction','Сторона відкривання'],['opening','Відкривання'],['color','Колір'],['material','Матеріал']]);
  for(const product of products)for(const spec of product.specifications||[])if(!specs.has(spec.key))specs.set(spec.key,spec.label);
  const rows=[{label:'Ціна',values:products.map(p=>money(p.price,p.currency)),price:true},{label:'Тип виробу',values:products.map(p=>p.category||'—')}];
  for(const [key,label] of specs){
    const values=products.map(p=>{const spec=(p.specifications||[]).find(s=>s.key===key);return spec?specText(spec):p[key]||'—';});
    if(values.some(value=>value!=='—'))rows.push({label,values});
  }
  return rows.map(row=>({...row,different:new Set(row.values.map(normalizedVariantValue)).size>1}));
}
function renderComparison() {
  const items=selections.comparison.map(byId).filter(Boolean),missing=unavailableSelections('comparison');
  if(!items.length){$('#comparison-content').innerHTML=missing+(selections.comparison.length?'':'<p class="empty-grid">Додайте товари кнопкою «Порівняти». Можна вибрати різні комплектації однієї моделі.</p>');return;}
  const onlyDifferent=$('#comparison-differences').checked;
  const rows=comparisonRows(items).filter(row=>!onlyDifferent||row.different);
  $('#comparison-content').innerHTML=missing+(items.length===1?'<p class="notice">Додайте ще одну комплектацію, щоб побачити відмінності.</p>':'')+`<div class="comparison-scroll"><table class="comparison-table"><caption class="sr-only">Порівняння обраних комплектацій</caption><thead><tr><th scope="col">Характеристики</th>${items.map(p=>`<th scope="col"><a class="comparison-photo" href="${escapeHtml(productUrl(p))}">${imageUrl(p.image)?`<img src="${escapeHtml(imageUrl(p.image))}" alt="${escapeHtml(p.name)}" loading="lazy">`:'<small>Фото не знайдено в базі даних</small>'}</a><h3><a href="${escapeHtml(productUrl(p))}">${escapeHtml(p.name)}</a></h3><span class="comparison-sku">${escapeHtml(p.variantName||'')}<br>Артикул: ${escapeHtml(p.sku)}</span><button type="button" class="comparison-remove" data-compare="${escapeHtml(p.id)}" aria-label="Прибрати ${escapeHtml(p.sku)} з порівняння">Прибрати</button></th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr class="${row.different?'comparison-different ':''}${row.price?'comparison-price':''}"><th scope="row">${escapeHtml(row.label)}</th>${row.values.map(value=>`<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${items.length+1}">Відмінностей у наявних характеристиках немає.</td></tr>`}</tbody></table></div>`;
}
function openShoppingList(key) {
  renderSelections();
  const id=key==='favorites'?'favorites-dialog':'comparison-dialog';
  for(const other of ['favorites-dialog','comparison-dialog'])if(other!==id&&$(`#${other}`).open)$(`#${other}`).close();
  if(!$(`#${id}`).open)$(`#${id}`).showModal();
}
let previousFocus = null;
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#brand-favicon')?.setAttribute('href', `/assets/brand-cart-${dark ? 'dark' : 'light'}.png`);
  $('#theme-icon').src = `/assets/icons/${dark ? 'sun' : 'moon'}.svg`;
  $('#theme-label').textContent = dark ? 'Світла тема' : 'Темна тема';
  $('#theme-toggle').setAttribute('aria-label', dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему');
  $('#theme-toggle').setAttribute('aria-pressed', String(dark));
}
$('#theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('vs-market-theme', theme); } catch {}
  syncTheme();
});
syncTheme();

let demoProducts = [];
function prepareDemoProducts(rows) {
  demoProducts = rows.map(([id, name, category, price, sku, crossSellSkus, upsellSkus, variantName]) => ({ id, name, category, price, sku, crossSellSkus, upsellSkus, variantName, currency: 'UAH', image: `/assets/${id.includes('window') ? 'window' : id.includes('interior') ? 'interior-door' : id.includes('door') ? 'door' : id.includes('mesh') ? 'mesh' : 'hardware'}.png`, availableTotal: null, material: id.includes('window') ? 'ПВХ' : id.includes('interior') ? 'Дерево' : id.includes('door') ? 'Метал' : '', opening: id.includes('window') ? 'Поворотно-відкидне' : id.includes('door') || id.includes('interior') ? 'Розпашне' : '' }));
const demoOrder = ['demo-window-1', 'demo-door-1', 'demo-interior-1', 'demo-window-2', 'demo-door-2', 'demo-mesh-1', 'demo-handle-1', 'demo-handle-2'];
demoProducts.sort((a,b) => demoOrder.indexOf(a.id) - demoOrder.indexOf(b.id));
for (const product of demoProducts) {
  const isWindow = product.category === 'Вікна', isDoor = product.category === 'Двері';
  const values = [['material','Матеріал',product.material],['opening','Відкривання',product.opening]];
  if (isWindow || isDoor) values.push(['color','Колір',isWindow ? 'Білий' : product.id.includes('interior') ? 'Дуб' : 'Антрацит']);
  if (isWindow) values.push(['profile','Профіль','Демонстраційний профіль'],['width','Ширина','1200','мм'],['height','Висота','1400','мм']);
  if (isDoor) values.push(['width','Ширина',product.id.includes('interior') ? '800' : '950','мм'],['height','Висота','2000','мм']);
  product.specifications = values.filter(([, , value]) => value).map(([key,label,value,unit='']) => ({key,label,value,unit,filterable:true,scope:'variant'}));
}
}
const specText = spec => `${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`;
function facetValue(product, key) {
  if (!key.startsWith('spec:')) return product[key] || '';
  const spec = (product.specifications || []).find(item => item.key === key.slice(5));
  return spec ? specText(spec) : '';
}
function productSpecifications(product) {
  const specs = product.specifications || [];
  return `<section class="product-specifications"><h3>Характеристики</h3>${state.demo ? '<p class="spec-notice">Параметри демонстраційного товару ілюстративні.</p>' : ''}${specs.length ? `<dl>${specs.map(spec => `<div><dt>${escapeHtml(spec.label)}</dt><dd>${escapeHtml(specText(spec))}</dd></div>`).join('')}</dl>` : '<p class="spec-notice">Характеристики ще не заповнені. Уточніть комплектацію в менеджера.</p>'}</section>`;
}

function loadCart() {
  try { const data = JSON.parse(localStorage.getItem(cartStore) || '{}'); if (data && typeof data === 'object' && !Array.isArray(data)) state.cart = data; } catch { /* A corrupt device-local cart starts empty. */ }
  try {const data=JSON.parse(localStorage.getItem(customCartStore)||'{}');for(const [id,item] of Object.entries(data)){if(/^custom-[a-z0-9-]{1,80}$/.test(id)&&Number.isInteger(item?.quantity)&&item.quantity>0&&item.quantity<=1000){try{state.customCart[id]={design:normalizeCustomDesign(item.design),quantity:item.quantity};}catch{}}}}catch{}
}
function saveCart() { try { localStorage.setItem(cartStore, JSON.stringify(state.cart));localStorage.setItem(customCartStore,JSON.stringify(state.customCart)); } catch {} renderCart(); if(typeof Event === 'function')document.dispatchEvent(new Event('vsmarket-cart-change')); }
function setQuantity(id, quantity) { if(state.customCart[id]){if(quantity<=0)delete state.customCart[id];else state.customCart[id].quantity=Math.min(1000,quantity);}else{if(!byId(id))return;if(quantity<=0)delete state.cart[id];else state.cart[id]=Math.min(1000,quantity);}saveCart(); }
const customCartStore=`vs-market-custom-cart-v1${state.demo?'-demo':''}`;
const customLabels={kind:{window:'Вікно',door:'Двері'},color:{white:'Білий',anthracite:'Антрацит','golden-oak':'Золотий дуб',walnut:'Горіх'},material:{pvc:'ПВХ',aluminium:'Алюміній',metal:'Метал',wood:'Дерево'},opening:{fixed:'Глухе',turn:'Поворотне','tilt-turn':'Поворотно-відкидне',left:'Ліве',right:'Праве'}};
function normalizeCustomDesign(value){
  const {kind,width,height,color,material,opening,sections}=value||{};
  if(!['window','door'].includes(kind)||!Number.isInteger(width)||!Number.isInteger(height)||width<100||width>6000||height<100||height>6000||!Object.prototype.hasOwnProperty.call(customLabels.color,color)||!(kind==='window'?['pvc','aluminium']:['metal','wood']).includes(material)||!(kind==='window'?['fixed','turn','tilt-turn']:['left','right']).includes(opening)||!Number.isInteger(sections)||sections<1||sections>(kind==='window'?3:1))throw new Error('Вкажіть цілі розміри від 100 до 6000 мм та виберіть комплектацію.');
  return {kind,width,height,color,material,opening,sections};
}
function customCartProduct(id,design){
  return {id,name:`${customLabels.kind[design.kind]} за індивідуальними розмірами`,variantName:`${design.width} × ${design.height} мм · ${customLabels.color[design.color]} · ${customLabels.material[design.material]} · ${customLabels.opening[design.opening]}${design.kind==='window'?` · секцій: ${design.sections}`:''}`,sku:null,price:null,currency:'UAH',customDesign:design,crossSellSkus:[],upsellSkus:[],image:''};
}
function addCustomProduct(value){
  const design=normalizeCustomDesign(value),existing=Object.entries(state.customCart).find(([,item])=>JSON.stringify(item.design)===JSON.stringify(design));
  const id=existing?.[0]||`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  state.customCart[id]={design,quantity:Math.min(1000,(state.customCart[id]?.quantity||0)+1)};saveCart();openModal('cart-drawer');return id;
}
function addProduct(id) { for(const list of ['favorites-dialog','comparison-dialog'])if($(`#${list}`).open)$(`#${list}`).close();setQuantity(id, (state.cart[id] || 0) + 1); openModal('cart-drawer'); }
function productArt(product, className = 'product-image') {
  const url = imageUrl(product.image);
  return `<div class="${className}">${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.imageAlt || product.name)}" loading="lazy">` : `<span class="placeholder-brand"><img src="/assets/icons/brand-placeholder.svg" alt=""><small>Фото не знайдено в базі даних</small></span>`}</div>`;
}
function productGallery(product) {
  const images=productImages(product);
  const main=images.length?`<button type="button" class="product-page-art photo-open" data-enlarge="${escapeHtml(product.id)}" aria-label="Збільшити фото ${escapeHtml(product.name)}"><img src="${escapeHtml(images[0].url)}" alt="${escapeHtml(images[0].alt)}"><span class="photo-open-label">Збільшити фото</span></button>`:productArt(product,'product-page-art');
  return `<div class="product-gallery"><div class="product-main-media">${main}${images.length>1?`<button type="button" class="gallery-arrow gallery-previous" data-product-photo-step="-1" aria-label="Попереднє фото">‹</button><button type="button" class="gallery-arrow gallery-next" data-product-photo-step="1" aria-label="Наступне фото">›</button><span class="gallery-photo-count" id="product-photo-count" aria-live="polite">1 / ${images.length}</span>`:''}</div>${images.length>1?`<div class="product-gallery-thumbs" aria-label="Фото товару">${images.map((item,i)=>`<button type="button" data-photo="${escapeHtml(item.id)}" aria-label="Фото ${i+1}" aria-pressed="${i===0}"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt)}" loading="lazy"></button>`).join('')}</div>`:''}</div>`;
}
function selectProductPhoto(index) {
  const images=productImages(state.activeProduct);if(!images.length)return;
  const chosen=(index%images.length+images.length)%images.length,item=images[chosen],image=$('.product-page-art img');
  if(!image)return;image.src=item.url;image.alt=item.alt;$('.photo-open').dataset.photoIndex=String(chosen);
  if($('#product-photo-count'))$('#product-photo-count').textContent=`${chosen+1} / ${images.length}`;
  document.querySelectorAll('[data-photo]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.photo===item.id)));
}
const cardPhotoIndexes=new Map();
function changeCardPhoto(media,step) {
  const product=byId(media?.dataset.galleryProduct);if(!product)return;
  const images=productImages(product);if(images.length<2)return;
  const index=((cardPhotoIndexes.get(product.id)||0)+step+images.length)%images.length,item=images[index];
  cardPhotoIndexes.set(product.id,index);
  const image=media.querySelector('.product-image > img');if(image){image.src=item.url;image.alt=item.alt;}
  const enlarge=media.querySelector('.card-photo-enlarge');if(enlarge)enlarge.dataset.photoIndex=String(index);
  const count=media.querySelector('.gallery-photo-count');if(count)count.textContent=`${index+1} / ${images.length}`;
}
function productImages(product) {
  const media=(product.media || []).filter(item=>imageUrl(item.url)).map(item=>({...item,url:imageUrl(item.url),alt:item.alt||product.name}));
  return media.length?media:imageUrl(product.image)?[{id:'primary',url:imageUrl(product.image),alt:product.imageAlt||product.name}]:[];
}
const photoView={images:[],index:0,zoom:1,previousOverflow:''};
function applyPhotoZoom() {
  const image=$('#photo-viewer-image'),frame=$('#photo-viewer-scroll'),canvas=$('#photo-viewer-canvas');
  if(image.naturalWidth&&image.naturalHeight&&frame.clientWidth&&frame.clientHeight){
    const fit=Math.min(frame.clientWidth/image.naturalWidth,frame.clientHeight/image.naturalHeight);
    const width=Math.round(image.naturalWidth*fit*photoView.zoom),height=Math.round(image.naturalHeight*fit*photoView.zoom);
    image.style.width=`${width}px`;image.style.height=`${height}px`;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
  }
  $('#photo-zoom-label').textContent=`${Math.round(photoView.zoom*100)}%`;
  $('#photo-zoom-out').disabled=photoView.zoom<=1;$('#photo-zoom-in').disabled=photoView.zoom>=4;
}
function renderPhotoViewer() {
  const photo=photoView.images[photoView.index];if(!photo)return;
  const image=$('#photo-viewer-image');image.style.width='100%';image.style.height='100%';
  $('#photo-viewer-canvas').style.width='100%';$('#photo-viewer-canvas').style.height='100%';
  image.src=photo.url;image.alt=photo.alt;
  $('#photo-viewer-count').textContent=`${photoView.index+1} / ${photoView.images.length}`;
  $('#photo-previous').hidden=$('#photo-next').hidden=photoView.images.length<2;
  $('#photo-viewer-scroll').scrollTop=0;$('#photo-viewer-scroll').scrollLeft=0;applyPhotoZoom();
}
function openPhotos(product,index=0) {
  const images=productImages(product);if(!images.length)return;
  photoView.images=images;photoView.index=Math.max(0,Math.min(index,images.length-1));photoView.zoom=1;
  $('#photo-viewer-title').textContent=`${product.name} · ${product.sku}`;
  photoView.previousOverflow=document.body.style.overflow||'';$('#photo-viewer').showModal();document.body.style.overflow='hidden';renderPhotoViewer();
}
function closePhotos(){if($('#photo-viewer').open)$('#photo-viewer').close();}
function changePhoto(step){photoView.index=(photoView.index+step+photoView.images.length)%photoView.images.length;photoView.zoom=1;renderPhotoViewer();}
function changePhotoZoom(step){photoView.zoom=Math.min(4,Math.max(1,photoView.zoom+step));applyPhotoZoom();}
function variantDimension(product,key) {
  const spec=(product.specifications || []).find(s=>s.key===key),value=String(spec?.value||'').trim().replace(/\s+/g,' ');
  if(key==='width'||key==='height')return value?`${value}${spec.unit?' '+spec.unit:''}`:'Уточнюється';
  return key==='opening_direction'?({'R':'Праве (R)','L':'Ліве (L)'}[value.toUpperCase()]||value||'Уточнюється'):value||'Уточнюється';
}
const normalizedVariantValue=value=>String(value).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('uk');
const variantValue=(product,key)=>normalizedVariantValue(variantDimension(product,key));
function variantAxes(variants) {
  const has=key=>variants.some(v=>(v.specifications||[]).some(s=>s.key===key&&s.value));
  const axes=[['width','Ширина'],['height','Висота']];
  if(has('opening_direction'))axes.push(['opening_direction','Сторона відкривання']);
  if(has('opening')&&(!has('opening_direction')||new Set(variants.map(v=>variantValue(v,'opening'))).size>1))axes.push(['opening','Відкривання']);
  if(has('color'))axes.push(['color','Колір']);
  return axes;
}
function variantOptions(variants,product,axes,index) {
  const previous=axes.slice(0,index).map(([key])=>key);
  const eligible=axes[index][0]==='color'?variants:variants.filter(v=>previous.every(key=>variantValue(v,key)===variantValue(product,key)));
  const key=axes[index][0],options=new Map();
  for(const variant of eligible){const value=variantValue(variant,key);if(!options.has(value)||variant.id===product.id)options.set(value,variantDimension(variant,key));}
  return [...options].sort((a,b)=>a[1].localeCompare(b[1],'uk',{numeric:true}));
}
function variantControls(variants,product) {
  const axes=variantAxes(variants);
  const matching=variants.filter(v=>axes.every(([key])=>variantValue(v,key)===variantValue(product,key)));
  return `<fieldset class="model-configuration"><legend>Оберіть параметри</legend><div class="variant-parameters">${axes.map(([key,label],index)=>{const values=variantOptions(variants,product,axes,index);return `<label>${label}<select data-variant-axis="${key}" ${values.length===1?'disabled':''}>${values.map(([value,text])=>`<option value="${escapeHtml(value)}" ${value===variantValue(product,key)?'selected':''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;}).join('')}</div>${matching.length>1?`<label class="variant-choice">Додаткова комплектація<select id="product-variant-choice">${matching.map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===product.id?'selected':''}>${escapeHtml(item.variantName||item.sku)} · ${escapeHtml(item.sku)} · ${escapeHtml(money(item.price,item.currency))}</option>`).join('')}</select></label>`:''}<p id="variant-selection-note" class="variant-selection-note" role="status">Ціна, фото та наявність відповідають обраним параметрам.</p></fieldset>`;
}
function changeVariantAxis(key,value) {
  const current=state.activeProduct;if(!current)return;
  const variants=state.products.filter(p=>p.productId? p.productId===current.productId:p.id===current.id),axes=variantAxes(variants),index=axes.findIndex(([axis])=>axis===key);
  if(index<0)return;
  const previous=key==='color'?[]:axes.slice(0,index).map(([axis])=>axis),next=key==='color'?axes.filter(([axis])=>axis!==key).map(([axis])=>axis):axes.slice(index+1).map(([axis])=>axis);
  const candidates=variants.filter(p=>previous.every(axis=>variantValue(p,axis)===variantValue(current,axis))&&variantValue(p,key)===normalizedVariantValue(value));
  const score=p=>next.reduce((sum,axis,i)=>sum+(variantValue(p,axis)===variantValue(current,axis)?2**(next.length-i):0),0);
  candidates.sort((a,b)=>score(b)-score(a)||(a.price??Infinity)-(b.price??Infinity)||a.sku.localeCompare(b.sku));
  if(!candidates.length)return;
  const chosen=candidates[0],changed=axes.filter(([axis])=>axis!==key&&variantValue(chosen,axis)!==variantValue(current,axis));
  selectVariant(chosen);
  if(changed.length){$('#variant-selection-note').textContent=`Доступний варіант для цього вибору: ${changed.map(([axis,label])=>`${label.toLocaleLowerCase('uk')} — ${variantDimension(chosen,axis)}`).join(', ')}.`;$('#variant-selection-note').classList.add('variant-selection-changed');}
  $(`[data-variant-axis="${key}"]`)?.focus();
}
function selectVariant(product) {
  const pickup=$('#product-pickup-location')?.value || '';
  renderProduct(product);history.replaceState(null,'',productUrl(product));
  if(pickup){$('#product-pickup-location').value=pickup;updateProductStock(pickup);}
}
function productUrl(product) {
  const params = new URLSearchParams();
  if (state.demo) params.set('demo','1');
  if (product.productId) params.set('variant',product.id);
  if(state.stockLocation)params.set('warehouse',state.stockLocation);
  return `/products/${encodeURIComponent(product.slug || product.id)}${params.size ? '?' + params : ''}`;
}
function catalogUrl(category='',search='',types=[]) {
  const params = new URLSearchParams();
  if (state.demo) params.set('demo','1');
  if (category) params.set('category',category);
  if(search)params.set('q',search);
  for(const type of types)params.append('type',type);
  if(state.stockLocation)params.set('warehouse',state.stockLocation);
  return `/catalog${params.size ? '?' + params : ''}`;
}
function dimensionInMillimetres(value,unit='мм') {
  const number=Number(String(value??'').trim().replace(',','.'));
  const factor={'мм':1,'mm':1,'см':10,'cm':10,'м':1000,'m':1000}[String(unit||'мм').toLocaleLowerCase('uk')];
  return number>0&&Number.isFinite(number)&&factor?number*factor:null;
}
function parseCatalogSearch(value) {
  let text=normalizedVariantValue(value),width=null,height=null;
  const pair=/(?<![\d-])(\d{2,4}(?:[.,]\d+)?)\s*(?:[xх×*]|\s)\s*(\d{3,4}(?:[.,]\d+)?)(?:\s*(мм|mm|см|cm))?(?![\d-])/iu;
  const match=pair.exec(text);
  if(match){width=dimensionInMillimetres(match[1],match[3]);height=dimensionInMillimetres(match[2],match[3]);text=text.slice(0,match.index)+' '+text.slice(match.index+match[0].length);}
  for(const [key,pattern] of [['width',/(?:ширина|шириною|width)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*(мм|mm|см|cm))?/iu],['height',/(?:висота|висотою|высота|height)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*(мм|mm|см|cm))?/iu]]){
    const named=pattern.exec(text);if(!named)continue;
    if(key==='width')width=dimensionInMillimetres(named[1],named[2]);else height=dimensionInMillimetres(named[1],named[2]);
    text=text.slice(0,named.index)+' '+text.slice(named.index+named[0].length);
  }
  return {width,height,terms:text.replace(/[(),;]/g,' ').trim().split(/\s+/).filter(Boolean)};
}
function matchesCatalogSearch(product,query) {
  for(const key of ['width','height'])if(query[key]!=null){
    const spec=(product.specifications||[]).find(item=>item.key===key);
    if(!spec||dimensionInMillimetres(spec.value,spec.unit)!==query[key])return false;
  }
  const haystack=normalizedVariantValue(`${product.name} ${product.variantName||''} ${product.sku} ${(product.specifications||[]).map(specText).join(' ')}`);
  return query.terms.every(term=>haystack.includes(term));
}
function catalogCards() {
  const query=parseCatalogSearch(state.search);
  const matching=state.products.filter(item=>(!state.category||item.category===state.category)&&matchesStockLocation(item)&&Object.entries(state.facets).every(([key,values])=>!values.length||values.includes(facetValue(item,key)))&&matchesCatalogSearch(item,query));
  const groups=new Map();
  for(const item of matching){
    const color=(item.specifications||[]).find(spec=>spec.key==='color')?.value||'';
    const key=JSON.stringify([item.productId||item.id,normalizedVariantValue(color),item.currency||'UAH']);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);
  }
  const items=[...groups.values()].map(variants=>{
    variants.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity)||Number(productImages(b).length>0)-Number(productImages(a).length>0)||a.sku.localeCompare(b.sku));
    const first=variants[0],prices=[...new Set(variants.map(p=>p.price))];
    const summary=['width','height'].flatMap(key=>{
      const values=[...new Set(variants.map(p=>variantDimension(p,key)))];return values.length===1&&values[0]!=='Уточнюється'?[`${key==='width'?'Ширина':'Висота'}: ${values[0]}`]:[];
    });
    return {...first,modelVariantCount:state.products.filter(p=>(p.productId||p.id)===(first.productId||first.id)).length,matchedVariantCount:variants.length,cardColor:String((first.specifications||[]).find(spec=>spec.key==='color')?.value||'').trim(),cardPrices:prices,cardSummary:summary.join(' · ')};
  });
  return {items,matching};
}
function cardPrice(product) {
  if(product.price==null)return '<small>Ціна за розрахунком</small>';
  const prices=product.cardPrices||[product.price];
  const known=prices.filter(price=>Number.isFinite(price));
  if(known.length>1)return `${escapeHtml(money(Math.min(...known),product.currency))} – ${escapeHtml(money(Math.max(...known),product.currency))}`;
  return `${prices.includes(null)?'від ':''}${escapeHtml(money(product.price,product.currency))}`;
}
function card(product) {
  const href = escapeHtml(productUrl(product));
  const multi=(product.matchedVariantCount??product.modelVariantCount??1)>1;
  const images=productImages(product),index=Math.min(cardPhotoIndexes.get(product.id)||0,Math.max(0,images.length-1)),photo=images[index];
  const summary=product.cardSummary??(product.specifications||[]).filter(spec=>['color','width','height'].includes(spec.key)).map(spec=>`${spec.label}: ${specText(spec)}`).join(' · ');
  return `<article class="product-card">
    <div class="product-card-media" data-gallery-product="${escapeHtml(product.id)}">
      <a class="product-image" href="${href}" aria-label="Переглянути ${escapeHtml(product.name)}">${photo?`<img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt)}" loading="lazy">`:'<span class="placeholder-brand"><img src="/assets/icons/brand-placeholder.svg" alt=""><small>Фото не знайдено в базі даних</small></span>'}</a>
      ${photo?`<button type="button" class="card-photo-enlarge" data-enlarge="${escapeHtml(product.id)}" data-photo-index="${index}" aria-label="Збільшити фото ${escapeHtml(product.name)}" title="Збільшити фото">⤢</button>`:''}
      ${images.length>1?`<button type="button" class="gallery-arrow gallery-previous" data-card-photo-step="-1" aria-label="Попереднє фото ${escapeHtml(product.name)}">‹</button><button type="button" class="gallery-arrow gallery-next" data-card-photo-step="1" aria-label="Наступне фото ${escapeHtml(product.name)}">›</button><span class="gallery-photo-count" aria-live="polite">${index+1} / ${images.length}</span>`:''}
    </div>
    <div class="product-body"><p class="product-category">${escapeHtml(product.category||'Каталог')}</p><h3 class="product-name"><a href="${href}">${escapeHtml(product.name)}</a></h3>${product.cardColor?`<p class="product-card-color">${escapeHtml(product.cardColor)}</p>`:''}<p class="product-variant">${multi?`${product.matchedVariantCount??product.modelVariantCount} комплектацій${product.cardColor?' цього кольору':''}`:escapeHtml(product.variantName||`Артикул ${product.sku}`)}</p><p class="product-spec-summary">${escapeHtml(summary|| (multi?'Розміри та відкривання на вибір':''))}</p>${product.recommendationReason?`<p class="recommendation-reason">${escapeHtml(product.recommendationReason)}</p>`:''}<p class="product-price">${!multi&&product.promotion?`<small class="promotion-badge">${escapeHtml(product.promotion.label)}</small><del>${escapeHtml(money(product.promotion.originalPrice))}</del> `:""}${cardPrice(product)}</p>${selectionControls(product)}<div class="card-actions">${multi?`<a class="add-button" href="${href}">Обрати варіант</a>`:`<button type="button" class="add-button" data-add="${escapeHtml(product.id)}"><img class="ui-icon" src="/assets/icons/file-description.svg" alt="">Додати в кошик</button>`}<a class="detail-button" href="${href}">Деталі</a></div></div>
  </article>`;
}
function renderCatalog() {
  if(onCatalogPage){const url=new URL(location.href);if(state.category)url.searchParams.set('category',state.category);else url.searchParams.delete('category');url.searchParams.delete('type');for(const type of state.facets['spec:product_type']||[])url.searchParams.append('type',type);const next=url.pathname+url.search+url.hash;if(next!==location.pathname+location.search+location.hash)history.replaceState(null,'',next);}
  const {items,matching}=catalogCards();
  if (state.sort === 'name') items.sort((a,b) => a.name.localeCompare(b.name, 'uk'));
  if (state.sort === 'name-desc') items.sort((a,b) => b.name.localeCompare(a.name, 'uk'));
  if (state.sort === 'price-asc') items.sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (state.sort === 'price-desc') items.sort((a,b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  if (!state.category) items.sort((a,b) => Number(a.category === 'Допи') - Number(b.category === 'Допи'));
  document.querySelectorAll('.catalog-tabs [data-browse]').forEach(button => { const active = button.dataset.browse === state.category; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  $('#result-count').textContent = `${items.length} пропозицій · ${matching.length} комплектацій${state.stockLocation?' · '+stockLocations[state.stockLocation]:''}`;
  $('#product-grid').innerHTML = items.length ? items.map(card).join('') : state.stockLocation&&!stockDataAvailable()?'<div class="empty-grid">Дані наявності ще недоступні. Виберіть «Усі товари», щоб переглянути каталог.</div>':'<div class="empty-grid">За цим запитом товарів немає. Спробуйте іншу назву, категорію або склад.</div>';
}
function stockDataAvailable(){return state.stockVerified||Boolean(state.stockSnapshotAt&&Number.isFinite(Date.parse(state.stockSnapshotAt)));}
function matchesStockLocation(product){
  if(!state.stockLocation)return true;
  if(!stockDataAvailable())return false;
  const locations=state.stockLocation==='any'?['mamaivtsi','magala']:[state.stockLocation];
  return locations.some(location=>Number(stockAt(product.sku,location)?.quantity||0)>0);
}
function warehouseFilter(){
  let note='Дані наявності ще недоступні.';
  if(stockDataAvailable()){
    const date=state.stockSnapshotAt&&Number.isFinite(Date.parse(state.stockSnapshotAt))?new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'}).format(new Date(state.stockSnapshotAt)):'';
    note=date?`За даними на ${date}. Наявність підтвердить менеджер.`:'Показуємо комплектації з доступним залишком на складі.';
  }
  return `<details class="filter-group warehouse-filter" open><summary>Наявність на складі</summary><label class="warehouse-filter-label" for="warehouse-filter">Показати товари<select id="warehouse-filter"><option value="" ${!state.stockLocation?'selected':''}>Усі товари</option>${Object.entries(stockLocations).map(([key,label])=>`<option value="${key}" ${state.stockLocation===key?'selected':''} ${stockDataAvailable()?'':'disabled'}>${key==='any'?'Є на будь-якому складі':label}</option>`).join('')}</select></label><p class="warehouse-filter-note">${escapeHtml(note)}</p></details>`;
}
function changeStockLocation(value){
  state.stockLocation=Object.hasOwn(stockLocations,value)?value:'';
  renderCatalog();
  if(onCatalogPage){const url=new URL(location.href);if(state.stockLocation)url.searchParams.set('warehouse',state.stockLocation);else url.searchParams.delete('warehouse');history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
function renderCategories() {
  const categories = [...new Set(state.products.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  $('#category').innerHTML = '<option value="">Усі категорії</option>' + categories.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
  $('#category').value = state.category;
  renderFilters();
}
function renderFilters() {
  const categoryProducts=state.products.filter(product=>(!state.category||product.category===state.category)&&(!state.facets.category.length||state.facets.category.includes(product.category)));
  renderConstructionTypes(categoryProducts);
  const groups = new Map([['category','Тип виробу'],['material','Матеріал'],['opening','Відкривання']]);
  for (const product of categoryProducts) for (const spec of product.specifications || []) {
    if (spec.filterable && !['material','opening','product_type'].includes(spec.key) && /^[a-z][a-z0-9_-]{0,63}$/.test(spec.key)) groups.set(`spec:${spec.key}`,spec.label);
  }
  $('#filter-groups').innerHTML = warehouseFilter()+[...groups].map(([key,title]) => {
    const values = [...new Set((key==='category'?state.products:categoryProducts).map(item => facetValue(item,key)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'uk',{numeric:true}));
    if(!values.length)return '';
    return `<details class="filter-group" ${['category','material','opening','spec:color'].includes(key)?'open':''}><summary>${escapeHtml(title)}</summary><div class="filter-options">${values.map(value => `<label><input type="checkbox" data-facet="${escapeHtml(key)}" value="${escapeHtml(value)}" ${(state.facets[key] || []).includes(value) ? 'checked' : ''}>${escapeHtml(value)}</label>`).join('')}</div></details>`;
  }).join('');
}
function renderConstructionTypes(products){
  const fieldset=$('#construction-types');
  const types=[...new Set(products.map(product=>facetValue(product,'spec:product_type')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'uk',{numeric:true}));
  fieldset.hidden=!types.length;
  if(!types.length){fieldset.innerHTML='';return;}
  const selected=state.facets['spec:product_type']||[];
  const prompt=state.category==='Двері'?'Які двері шукаєте?':state.category==='Вікна'?'Оберіть тип вікон':'Оберіть потрібний тип виробу';
  fieldset.innerHTML=`<legend>Тип конструкції</legend><p class="construction-types-prompt">${prompt}</p><div class="construction-type-options"><button type="button" class="construction-type-all" data-clear-types aria-pressed="${!selected.length}">Усі типи</button>${types.map(type=>`<label class="construction-type-choice"><input type="checkbox" data-construction-type value="${escapeHtml(type)}" ${selected.includes(type)?'checked':''}><span>${escapeHtml(type)}</span></label>`).join('')}</div>`;
}
function browse(category) {
  state.category = category; state.facets = {category: [], material: [], opening: []};
  $('#category').value = category; renderFilters(); renderCatalog();
}
function recommendations(product, kind) {
  if(product.recommendations)return (product.recommendations[kind]||[]).map(r=>{const item=bySku(r.sku);return item?{...item,recommendationReason:r.reason}:null;}).filter(Boolean);
  const selected = (kind === 'upsell' ? product.upsellSkus : product.crossSellSkus).map(bySku).filter(Boolean).filter((item) => item.id !== product.id);
  if (selected.length) return selected.slice(0, 3);
  return [];
}
function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  $('#cart-count').textContent = count;
  $('#cart-title-count').textContent = count;
  $('#cart-items').innerHTML = lines.length ? lines.map(({ product, quantity }) => `<div class="cart-item">${product.customDesign ? `<div class="cart-thumb">VS.</div>` : `<a class="cart-thumb" href="${escapeHtml(productUrl(product))}" aria-label="Переглянути модель ${escapeHtml(product.name)}">${imageUrl(product.image) ? `<img src="${escapeHtml(imageUrl(product.image))}" alt="">` : 'VS.'}</a>`}<div><strong>${product.customDesign ? escapeHtml(product.name) : `<a class="cart-model-link" href="${escapeHtml(productUrl(product))}">${escapeHtml(product.name)}</a>`}</strong><small>${escapeHtml(product.variantName || product.sku)}</small><div class="qty"><button type="button" data-qty="${escapeHtml(product.id)}" data-change="-1" aria-label="Зменшити кількість ${escapeHtml(product.name)}">−</button><span>${quantity}</span><button type="button" data-qty="${escapeHtml(product.id)}" data-change="1" aria-label="Збільшити кількість ${escapeHtml(product.name)}">+</button><button type="button" class="remove" data-remove="${escapeHtml(product.id)}">Видалити</button></div></div><div class="cart-item-price">${product.price == null ? '—' : escapeHtml(money(product.price * quantity, product.currency))}</div></div>`).join('') : '<p class="empty-grid">Кошик порожній. Додайте товар із каталогу.</p>';
  const completePrices = lines.every(({ product }) => product.price != null);
  const knownTotal=lines.reduce((sum,{product,quantity})=>sum+(product.price??0)*quantity,0);
  $('#cart-total').textContent = lines.length && completePrices ? money(knownTotal) : knownTotal?`${money(knownTotal)} + за розрахунком`:'За розрахунком';
  $('#checkout-button').disabled = !lines.length;
  const chosen = new Set(lines.map(({ product }) => product.id));
  const suggested = [...new Map(lines.flatMap(({ product }) => [...recommendations(product, 'cross'),...recommendations(product, 'related')].map((item) => [item.id, item]))).values()].filter((item) => !chosen.has(item.id)).slice(0, 2);
  $('#cart-recommendations').hidden = !suggested.length;
  $('#cart-suggestions').innerHTML = suggested.map((item) => `<div class="suggestion"><div><strong>${escapeHtml(item.name)}</strong>${item.recommendationReason?`<small>${escapeHtml(item.recommendationReason)}</small>`:''}<small>${escapeHtml(money(item.price, item.currency))}</small></div><button type="button" data-add="${escapeHtml(item.id)}">Додати</button></div>`).join('');
}
function requestedProduct() {
  const match = /^\/products\/([^/]+)\/?$/.exec(new URL(location.href).pathname);
  if (!match) return null;
  let slug; try { slug = decodeURIComponent(match[1]); } catch { return null; }
  const variant = new URLSearchParams(location.search).get('variant');
  return state.products.find(item => (item.slug || item.id) === slug && (!variant || item.id === variant)) || null;
}
function renderProduct(product) {
  $('#home-page').hidden = true; $('#product-page').hidden = false;
  if (!product) {
    document.title = 'Товар не знайдено — VS Market';
    $('#product-page').innerHTML = `<div class="product-page-empty"><h1 id="product-title">${state.catalogError ? 'Не вдалося завантажити товар' : 'Товар не знайдено'}</h1><p>${escapeHtml(state.catalogError || 'Цього товару більше немає в каталозі. Перегляньте інші пропозиції.')}</p><a class="primary-link" href="${escapeHtml(catalogUrl())}">До каталогу</a></div>`;
    return;
  }
  state.activeProduct = product; document.title = `${product.name} — VS Market`;
  const variants = state.products.filter(item => product.productId ? item.productId === product.productId : item.id === product.id);
  const upsells = recommendations(product,'upsell'), crossSells = [...recommendations(product,'cross'),...recommendations(product,'related')], similar = recommendations(product,'similar');
  $('#product-page').innerHTML = `<nav class="breadcrumbs" aria-label="Шлях до товару"><a href="${escapeHtml(catalogUrl())}">Каталог</a><span aria-hidden="true">/</span><a href="${escapeHtml(catalogUrl(product.category))}">${escapeHtml(product.category || 'Товари')}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(product.name)}</span></nav>${state.demo ? '<p class="notice">Демонстраційний товар. Фото та параметри ілюстративні; реальні ціни й залишки не підключені. Заявки не надсилаються.</p>' : ''}<div class="product-page-layout">${productGallery(product)}<div class="product-page-copy"><p class="product-category">${escapeHtml(product.category || 'Каталог')}</p><h1 id="product-title" tabindex="-1">${escapeHtml(product.name)}</h1><p class="product-page-subtitle">${escapeHtml(product.variantName || '')}</p><p class="product-page-sku">Артикул: ${escapeHtml(product.sku)}</p>${variants.length > 1 ? variantControls(variants,product) : ''}${selectionControls(product)}<p class="product-price">${product.promotion?`<small class="promotion-badge">${escapeHtml(product.promotion.label)}</small><del>${escapeHtml(money(product.promotion.originalPrice))}</del> `:""}${escapeHtml(money(product.price,product.currency))}</p><button class="primary-button full" type="button" data-add="${escapeHtml(product.id)}">Додати в кошик</button><p class="small-note">Остаточну ціну та комплектацію підтвердить менеджер.</p><section class="product-pickup"><h2>Наявність для самовивозу</h2><label for="product-pickup-location">Оберіть ринок</label><select id="product-pickup-location"><option value="">Місце самовивозу</option><option value="mamaivtsi">Мамаївці</option><option value="magala">Магала</option></select><p id="product-stock-status" role="status">Виберіть ринок, щоб переглянути наявність.</p></section></div></div><div class="product-page-information"><section class="product-description"><h2>Про товар</h2><p>${escapeHtml(product.description || 'Розміри, оздоблення та комплектацію можна уточнити у менеджера. Додайте товар в кошик та вкажіть свої побажання.')}</p></section>${productSpecifications(product)}</div>${upsells.length ? `<section class="product-page-recommendations"><h2>Кращі альтернативи</h2><div class="product-grid">${upsells.map(card).join('')}</div></section>` : ''}${crossSells.length ? `<section class="product-page-recommendations"><h2>Разом із цим товаром</h2><div class="product-grid">${crossSells.map(card).join('')}</div></section>` : ''}${similar.length ? `<section class="product-page-recommendations"><h2>Схожі товари</h2><div class="product-grid">${similar.map(product=>card({...product,recommendationReason:''})).join('')}</div></section>` : ''}<section class="product-page-recommendations"><h2>Комплектація та монтаж</h2><p>Ручки, замки й сітки потрібно підбирати під конкретний виріб. Уточніть сумісність, вартість і можливість монтажу у менеджера.</p><a class="detail-button" href="tel:+380666709777">Уточнити комплектацію та монтаж</a></section><a class="back-to-catalog" href="${escapeHtml(catalogUrl(product.category))}">← Повернутися до каталогу</a>`;
  if(['mamaivtsi','magala'].includes(state.stockLocation)){$('#product-pickup-location').value=state.stockLocation;updateProductStock(state.stockLocation);}
}
function updateProductStock(locationKey) {
  const status = $('#product-stock-status');
  if (!locationKey) { status.textContent = 'Виберіть ринок, щоб переглянути наявність.'; return; }
  const label = locationKey === 'mamaivtsi' ? 'Мамаївці' : 'Магала';
  const item = stockAt(state.activeProduct.sku,locationKey);
  if (!state.stockVerified && state.stockSnapshotAt && item) {
    const time = new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'}).format(new Date(state.stockSnapshotAt));
    status.textContent = `${label}: ${item.quantity > 0 ? `доступно ${item.quantity}` : 'немає в наявності'}. Оновлено ${time}. Актуальну наявність підтвердить менеджер.`;
    return;
  }
  status.textContent = !state.stockVerified ? `Залишки для ${label} ще не підключені. Наявність уточнить менеджер.` : !item ? `Для ${label} немає підтвердженого залишку. Уточніть у менеджера.` : item.quantity > 0 ? `${label}: доступно ${item.quantity}. Наявність повторно перевіриться перед надсиланням заявки.` : `${label}: зараз немає в наявності. Узгодьте інший варіант із менеджером.`;
}
function openModal(id) { if ($('#overlay').hidden) previousFocus = document.activeElement; $('#overlay').hidden = false; for (const modal of ['cart-drawer']) $(`#${modal}`).hidden = modal !== id; document.body.style.overflow = 'hidden'; $(`#${id}`).querySelector('button')?.focus(); }
function closeModal() { $('#overlay').hidden = true; for (const modal of ['cart-drawer']) $(`#${modal}`).hidden = true; document.body.style.overflow = ''; if (previousFocus?.isConnected) previousFocus.focus(); }
async function loadCatalog() {
  $('#year').textContent = new Date().getFullYear();
  loadCart();
  loadSelections();
  if(!onProductPage&&!onCatalogPage&&!onCheckoutPage&&(new URL(location.href).hash==='#catalog'||new URLSearchParams(location.search).has('category')||new URLSearchParams(location.search).has('list'))){const params=new URLSearchParams(location.search);location.replace('/catalog'+(params.size?'?'+params:''));return;}
  $('#home-page').hidden=onProductPage||onCatalogPage||onCheckoutPage;$('#catalog').hidden=!onCatalogPage;
  if (onProductPage) { $('#product-page').hidden = false; }
  if(onCatalogPage)document.title='Каталог вікон та дверей — VS Market';
  $('#search').value=state.search;
  document.querySelectorAll('.brand, .footer-brand').forEach(link => { link.href = state.demo ? '/?demo=1' : '/'; });
  document.querySelectorAll('a[data-browse]').forEach(link => { link.href = catalogUrl(link.dataset.browse); });
  document.querySelectorAll('[data-footer-catalog]').forEach(link=>{link.href=catalogUrl();});
  document.querySelectorAll('.skip-link').forEach(link=>{link.href=onProductPage?'#product-page':onCatalogPage?'#catalog':onCheckoutPage?(location.href.includes('/proposal')?'#proposal-page':'#checkout-page'):'#home-page';});
  if (state.demo) {
    $('#live-catalog-link').hidden = false;
    const response = await fetch('/catalog-demo.json');
    prepareDemoProducts(await response.json());
    state.products = demoProducts;
    $('#catalog-notice').hidden = false;
    $('#catalog-notice').innerHTML = 'Демонстраційний каталог. Товари й ціни ілюстративні. <a href="/#catalog">Відкрити актуальний каталог</a>.';
    $('#top-status').textContent = 'Демо';
  } else {
    try {
      const response = await fetch('/api/catalog'); const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Каталог тимчасово недоступний');
      state.products = (result.products || []).map(product=>{
        if(!['Фурнітура','Підвіконня','Москітні сітки'].includes(product.category))return product;
        const specs=product.specifications||[];
        return {...product,sourceCategory:product.category,category:'Допи',specifications:specs.some(s=>s.key==='product_type')?specs:[...specs,{key:'product_type',label:'Тип виробу',value:product.category,filterable:true}]};
      });
      if(['Фурнітура','Підвіконня','Москітні сітки'].includes(state.category)){const old=state.category;state.category='Допи';if(old!=='Фурнітура'&&!state.facets['spec:product_type'].length)state.facets['spec:product_type']=[old];} state.stock = result.stock || []; state.stockVerified = Boolean(result.stockVerified); state.stockSnapshotAt = result.stockSnapshotAt || null;
      $('#top-status').textContent = 'Каталог онлайн';
    } catch (error) {
      state.catalogError = error.message;
      $('#catalog-notice').hidden = false;
      $('#catalog-notice').textContent = `${error.message}. Спробуйте відкрити каталог пізніше.`;
      $('#top-status').textContent = 'Підключення каталогу';
    }
  }
  renderCategories(); renderCatalog(); renderCart(); renderSelections();
  if (onProductPage) renderProduct(requestedProduct());
  const requestedList=new URLSearchParams(location.search).get('list');
  if(requestedList==='favorites'||requestedList==='comparison')openShoppingList(requestedList);
  if(new URLSearchParams(location.search).get('cart')==='1')openModal('cart-drawer');
}

document.addEventListener('click', (event) => {
  const allTypes=event.target.closest('[data-clear-types]');if(allTypes){state.facets['spec:product_type']=[];renderFilters();renderCatalog();return;}
  const favorite=event.target.closest('[data-favorite]');if(favorite)return toggleSelection('favorites',favorite.dataset.favorite);
  const compare=event.target.closest('[data-compare]');if(compare)return toggleSelection('comparison',compare.dataset.compare);
  const closeList=event.target.closest('[data-close-list]');if(closeList){$(`#${closeList.dataset.closeList}`).close();return;}
  const link = event.target.closest('[data-browse]'); if (link) { event.preventDefault(); if (!onCatalogPage) { location.assign(catalogUrl(link.dataset.browse)); return; } browse(link.dataset.browse); $('#catalog').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); return; }
  const cardStep=event.target.closest('[data-card-photo-step]');if(cardStep){event.preventDefault();changeCardPhoto(cardStep.closest('.product-card-media'),Number(cardStep.dataset.cardPhotoStep));return;}
  const productStep=event.target.closest('[data-product-photo-step]');if(productStep){event.preventDefault();selectProductPhoto(Number($('.photo-open').dataset.photoIndex||0)+Number(productStep.dataset.productPhotoStep));return;}
  const photo=event.target.closest('[data-photo]');
  if(photo){const index=productImages(state.activeProduct).findIndex(m=>m.id===photo.dataset.photo);if(index>=0)selectProductPhoto(index);return;}
  const enlarge=event.target.closest('[data-enlarge]');
  if(enlarge){const product=byId(enlarge.dataset.enlarge);if(product)openPhotos(product,Number(enlarge.dataset.photoIndex||0));return;}
  const add = event.target.closest('[data-add]'); if (add) return addProduct(add.dataset.add);
  const qty = event.target.closest('[data-qty]'); if (qty) return setQuantity(qty.dataset.qty, (state.customCart[qty.dataset.qty]?.quantity||state.cart[qty.dataset.qty] || 0) + Number(qty.dataset.change));
  const remove = event.target.closest('[data-remove]'); if (remove) return setQuantity(remove.dataset.remove, 0);
});
$('#search').addEventListener('input', (event) => { state.search = event.target.value.trim().toLocaleLowerCase('uk'); renderCatalog(); });
$('#category').addEventListener('change', (event) => browse(event.target.value));
$('#sort').addEventListener('change', (event) => { state.sort = event.target.value; renderCatalog(); });
$('#filter-groups').addEventListener('change', (event) => {
  if(event.target.id==='warehouse-filter'){changeStockLocation(event.target.value);return;}
  const input = event.target.closest('[data-facet]'); if (!input) return;
  if (input.dataset.facet === 'category') { state.category = ''; $('#category').value = ''; }
  state.facets[input.dataset.facet] = [...$('#filter-groups').querySelectorAll(`[data-facet="${input.dataset.facet}"]:checked`)].map(item => item.value);
  if(input.dataset.facet==='category'){state.facets['spec:product_type']=[];renderFilters();}
  renderCatalog();
});
$('#reset-filters').addEventListener('click', () => { state.search = ''; $('#search').value = ''; state.sort = 'default'; $('#sort').value = 'default';changeStockLocation(''); browse(''); });
$('#header-search').addEventListener('click', () => { if (!onCatalogPage) { location.assign(catalogUrl()); return; } $('#catalog').scrollIntoView(); $('#search').focus({preventScroll:true}); });
$('#cart-trigger').addEventListener('click', () => openModal('cart-drawer'));
$('#favorites-trigger').addEventListener('click',()=>openShoppingList('favorites'));
$('#comparison-trigger').addEventListener('click',()=>openShoppingList('comparison'));
$('#comparison-differences').addEventListener('change',renderComparison);
$('#close-cart').addEventListener('click', closeModal);

$('#overlay').addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => {
  if($('#photo-viewer').open){
    if(event.key==='Escape'){event.preventDefault();closePhotos();}
    if(event.key==='ArrowRight'){event.preventDefault();changePhoto(1);}
    if(event.key==='ArrowLeft'){event.preventDefault();changePhoto(-1);}
    return;
  }
  if (event.key === 'Escape') closeModal();
  if (event.key !== 'Tab' || $('#overlay').hidden) return;
  const modal = ['cart-drawer'].map((id) => $(`#${id}`)).find((element) => !element.hidden);
  const controls = [...modal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')].filter((element) => element.getClientRects().length);
  if (!controls.length) return;
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
});
$('#photo-close').addEventListener('click',closePhotos);
$('#photo-previous').addEventListener('click',()=>changePhoto(-1));
$('#photo-next').addEventListener('click',()=>changePhoto(1));
$('#photo-zoom-out').addEventListener('click',()=>changePhotoZoom(-0.5));
$('#photo-zoom-in').addEventListener('click',()=>changePhotoZoom(0.5));
$('#photo-zoom-reset').addEventListener('click',()=>{photoView.zoom=1;renderPhotoViewer();});
$('#photo-viewer-image').addEventListener('load',applyPhotoZoom);
$('#photo-viewer-image').addEventListener('dblclick',()=>{photoView.zoom=photoView.zoom===1?2:1;applyPhotoZoom();});
$('#photo-viewer').addEventListener('close',()=>{document.body.style.overflow=photoView.previousOverflow;});
$('#photo-viewer').addEventListener('click',event=>{if(event.target===$('#photo-viewer'))closePhotos();});
globalThis.addEventListener?.('resize',()=>{if($('#photo-viewer').open)applyPhotoZoom();});
$('#checkout-button').addEventListener('click', () => { if(cartLines().length)location.assign('/checkout'+(state.demo?'?demo=1':'')); });


document.addEventListener('change', event => {
  if(event.target.dataset && Object.hasOwn(event.target.dataset,'constructionType')){state.facets['spec:product_type']=[...$('#construction-types').querySelectorAll('[data-construction-type]:checked')].map(input=>input.value);$('#construction-types [data-clear-types]').setAttribute('aria-pressed',String(!state.facets['spec:product_type'].length));renderCatalog();}
  if (event.target.id === 'product-variant-choice') selectVariant(byId(event.target.value));
  if(event.target.dataset?.variantAxis){
    changeVariantAxis(event.target.dataset.variantAxis,event.target.value);
  }
  if (event.target.id === 'product-pickup-location') updateProductStock(event.target.value);
});
const catalogReady = loadCatalog().catch(() => { state.catalogError = 'Каталог тимчасово недоступний'; if (onProductPage) renderProduct(null); else { $('#catalog-notice').hidden = false; $('#catalog-notice').textContent = state.catalogError; } });
if(!state.demo && globalThis.VSMarketSelections)globalThis.VSMarketSelections.subscribe(value=>{Object.assign(selections,value);catalogReady.then(renderSelections);});
globalThis.VSMarketShop={ready:catalogReady,productUrl,cartLines,clearCart:()=>{state.cart={};state.customCart={};saveCart();},labels:customLabels,normalizeDesign:normalizeCustomDesign,addCustomProduct,catalogUrl,products:()=>state.products,renderCard:card,stock:()=>({items:state.stock,verified:state.stockVerified,snapshotAt:state.stockSnapshotAt}),isDemo:state.demo};

let cartSyncOwner=null,cartSyncBase=[],cartSyncCustom={},cartSyncBusy=false,cartSyncDirty=false,cartSyncApplying=false,cartSyncTimer,cartSyncVersion=0;
const syncLines=()=>Object.entries(state.cart).filter(([id,q])=>typeof id==='string'&&Number.isInteger(q)&&q>0&&q<=999).map(([id,quantity])=>({id,quantity}));
async function cartRequest(body){const r=await fetch('/api/auth/cart',{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Не вдалося синхронізувати кошик.');return data;}
function applySyncedCart(data){cartSyncBase=data.lines;cartSyncCustom=data.custom||{};state.cart=Object.fromEntries(data.lines.map(l=>[l.id,l.quantity]));state.customCart={};for(const [id,item] of Object.entries(data.custom||{})){try{state.customCart[id]={quantity:item.quantity,design:normalizeCustomDesign(item.design)};}catch{}}cartSyncApplying=true;saveCart();cartSyncApplying=false;localStorage.setItem('vs-market-cart-owner',data.owner);}
async function syncAccountCart(){
 if(state.demo||cartSyncBusy)return;cartSyncBusy=true;
 try{
  await catalogReady;const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('Синхронізація кошика тимчасово недоступна.');const {user}=await r.json();
  const storedOwner=localStorage.getItem('vs-market-cart-owner');
  if(!user){if(storedOwner){state.cart={};state.customCart={};cartSyncApplying=true;saveCart();cartSyncApplying=false;localStorage.removeItem('vs-market-cart-owner');}cartSyncOwner=null;cartSyncBase=[];cartSyncCustom={};cartSyncDirty=false;return;}
  const changed=cartSyncOwner!==user.id;
  if(changed){
   const guest=!storedOwner,guestLines=guest?syncLines():[],guestCustom=guest?structuredClone(state.customCart):{},localBefore=syncLines(),customBefore=structuredClone(state.customCart),version=cartSyncVersion;
   // Never transfer a previous account's local basket into a different account.
   let data=guest&&(guestLines.length||Object.keys(guestCustom).length)?await cartRequest({owner:user.id,lines:guestLines,custom:guestCustom,merge:true}):await cartRequest();
   if(version!==cartSyncVersion)data=await cartRequest({owner:user.id,lines:syncLines(),custom:state.customCart,base:localBefore,baseCustom:customBefore});
   cartSyncOwner=user.id;applySyncedCart(data);cartSyncDirty=false;
  }else if(cartSyncDirty){
   const lines=syncLines(),custom=structuredClone(state.customCart);cartSyncDirty=false;
   const data=await cartRequest({owner:user.id,lines,custom,base:cartSyncBase,baseCustom:cartSyncCustom});
   if(!cartSyncDirty)applySyncedCart(data);else{cartSyncBase=data.lines;cartSyncCustom=data.custom||{};}
  }else{const version=cartSyncVersion,data=await cartRequest();if(version===cartSyncVersion&&!cartSyncDirty)applySyncedCart(data);}
 }catch(error){cartSyncDirty=true;const note=document.querySelector('#selection-status');if(note){note.hidden=false;note.textContent=error.message+' Кошик збережено на цьому пристрої.';}}
 finally{cartSyncBusy=false;if(cartSyncDirty){clearTimeout(cartSyncTimer);cartSyncTimer=setTimeout(syncAccountCart,3000);}}
}
document.addEventListener('vsmarket-cart-change',()=>{if(cartSyncApplying||state.demo)return;cartSyncVersion++;cartSyncDirty=true;clearTimeout(cartSyncTimer);cartSyncTimer=setTimeout(syncAccountCart,250);});
window.addEventListener('focus',syncAccountCart);
window.addEventListener('storage',event=>{if(event.key==='vs-market-account-change')void syncAccountCart();});
window.addEventListener('online',syncAccountCart);
setInterval(()=>{if(!document.hidden)void syncAccountCart();},15000);
catalogReady.then(syncAccountCart);
globalThis.VSMarketShop.syncCart=syncAccountCart;
