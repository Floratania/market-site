import {filterManageProducts} from './manage-filters.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeUrl=value=>{try{const url=new URL(value,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
const money=value=>value==null?'За розрахунком':new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value)+' грн';
const statusLabels={received:'Нове',confirmed:'Підтверджене',shipped:'Відправлене',completed:'Завершене',cancelled:'Скасоване'};
let account,products=[],records=[],view='overview',revision=0;
let interest=null;
let users=[],polling=false;
const usersButton=document.createElement('button');usersButton.dataset.view='users';usersButton.textContent='♙ Користувачі';document.querySelector('nav').append(usersButton);
const noticesButton=document.createElement('button');noticesButton.dataset.view='notifications';noticesButton.textContent='♧ Повідомлення';document.querySelector('nav').append(noticesButton);
function readIds(){try{return new Set(JSON.parse(localStorage.getItem('vsmarket-manage-read-'+account.user.id)||'[]'));}catch{return new Set();}}
function renderNotifications(){
 const read=readIds(),unread=records.filter(r=>!read.has(r.order.id));noticesButton.textContent='♧ Повідомлення'+(unread.length?' ('+unread.length+')':'');
 $('#notifications-list').innerHTML=records.length?records.map(({order:o,notifications:n})=>`<details><summary>${read.has(o.id)?'Прочитано':'● Нове повідомлення'} · Замовлення № ${escape(o.id.slice(0,8).toUpperCase())} · ${escape(o.customer.name)} · ${escape(new Date(o.createdAt).toLocaleString('uk-UA'))}</summary><p>Статус: ${escape(statusLabels[o.status||'received'])}</p><p>${Object.keys(n||{}).length?Object.entries(n).map(([key,value])=>escape(key==='email'?'Email':'Telegram')+': '+(value.status==='sent'?'надіслано':'очікує надсилання')).join(' · '):'Надсилання на email і Telegram для цього замовлення не увімкнено.'}</p><button data-open-order="${escape(o.id)}">Відкрити замовлення</button></details>`).join(''):'<p>Повідомлень ще немає.</p>';
}
function renderUsers(){
 const q=$('#user-search').value.trim().toLocaleLowerCase('uk');const rows=users.filter(u=>`${u.name} ${u.email} ${u.phone}`.toLocaleLowerCase('uk').includes(q));$('#user-count').textContent=rows.length+' покупців';
 $('#users-list').innerHTML=rows.map(u=>`<details><summary><b>${escape(u.name)}</b> · ${escape(u.email)} · ${u.active?'Активний':'Неактивний'}${u.orders?' · Замовлень: '+u.orders.length:''}</summary><p>Телефон: ${escape(u.phone||'Не вказано')}</p><p>Зареєстровано: ${escape(new Date(u.joinedAt).toLocaleString('uk-UA'))}</p>${u.orders?'<h3>Замовлення покупця</h3>'+u.orders.map(o=>`<p><button data-open-order="${escape(o.id)}">№ ${escape(o.id.slice(0,8).toUpperCase())}</button> · ${escape(statusLabels[o.status])} · ${escape(money(o.total))}</p>`).join('')+(u.orders.length?'':'<p>Замовлень ще немає.</p>'):'<p>Для перегляду замовлень потрібне право керування замовленнями.</p>'}</details>`).join('')||'<p>Покупців за цим запитом немає.</p>';
}
$('#user-search').addEventListener('input',renderUsers);
$('#read-notifications').addEventListener('click',()=>{try{localStorage.setItem('vsmarket-manage-read-'+account.user.id,JSON.stringify(records.map(r=>r.order.id)));renderNotifications();}catch{$('#notification-status').textContent='Не вдалося зберегти позначення прочитаних.';}});
 document.addEventListener('click',event=>{const button=event.target.closest('[data-open-order]');if(!button||!account.canOrders)return;try{const read=readIds();read.add(button.dataset.openOrder);localStorage.setItem('vsmarket-manage-read-'+account.user.id,JSON.stringify([...read]));renderNotifications();}catch{}$('#order-search').value=button.dataset.openOrder;renderOrders();showView('orders');const detail=$('#orders-list details');if(detail)detail.open=true;});
setInterval(async()=>{if(!account?.canOrders||$('#workspace').hidden||document.hidden||polling||$('#refresh').disabled)return;polling=true;try{const owner=account.user.id,version=revision,result=await request('/api/manage/orders');if(version!==revision||owner!==account?.user.id)return;const changed=result.records.some(r=>!records.some(old=>old.order.id===r.order.id));records=result.records;$('#order-count').textContent=records.length;renderNotifications();$('#notification-status').textContent='Оновлено: '+new Date().toLocaleTimeString('uk-UA');if(changed)$('#message').textContent='Є нове замовлення. Відкрийте повідомлення або список замовлень.';}catch(error){$('#notification-status').textContent=error.message;}finally{polling=false;}},30000);
const interestButton=document.createElement('button');interestButton.dataset.view='interest';interestButton.textContent='♡ Інтерес покупців';interestButton.setAttribute('aria-pressed','false');document.querySelector('nav').append(interestButton);
function renderInterest(){
 const q=$('#interest-search').value.trim().toLocaleLowerCase('uk');
 if(!interest){$('#interest-ranking').textContent='Статистика ще не завантажена.';$('#interest-customers').innerHTML='';return;}
 $('#interest-summary').innerHTML=[['Зареєстровані покупці',interest.registered],['З обраними товарами',interest.withFavorites],['З кошиком',interest.withCart]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
 const match=p=>!q||`${p.name} ${p.variantName} ${p.sku}`.toLocaleLowerCase('uk').includes(q);
 $('#interest-ranking').innerHTML='<table><thead><tr><th>Товар / комплектація</th><th>Покупців</th><th>Обране</th><th>Кошики</th><th>Одиниць у кошиках</th><th>Налаштування</th></tr></thead><tbody>'+interest.ranking.filter(match).map(p=>`<tr><td><b>${escape(p.name)}</b><small>${escape(p.variantName)}<br>${escape(p.sku)}</small></td><td>${p.customers}</td><td>${p.favorites}</td><td>${p.carts}</td><td>${p.quantity}</td><td>${account.canProducts&&p.productId?`<button data-edit-product="${escape(p.productId)}" data-variant="${escape(p.id)}">Редагувати товар і рекомендації</button>`:'—'}</td></tr>`).join('')+'</tbody></table>';
 const line=p=>`<li>${escape(p.name)} · ${escape(p.variantName)} · ${escape(p.sku)}${p.quantity?' × '+p.quantity:''}</li>`;
 $('#interest-customers').innerHTML=interest.customers.filter(u=>!q||`${u.name} ${u.email}`.toLocaleLowerCase('uk').includes(q)||[...u.favorites,...u.cart].some(match)).map(u=>`<details><summary>${escape(u.name)} · ${escape(u.email)} · Обране: ${u.favorites.length}, кошик: ${u.cart.length}</summary><h4>Обрані товари</h4><ul>${u.favorites.map(line).join('')||'<li>Немає</li>'}</ul><h4>Кошик</h4><ul>${u.cart.map(line).join('')||'<li>Порожній</li>'}</ul><p>Оновлення кошика: ${u.updatedAt?escape(new Date(u.updatedAt).toLocaleString('uk-UA')):'ще не збережено'}</p></details>`).join('')||'<p>Списків за цим запитом немає.</p>';
}
$('#interest-search').addEventListener('input',renderInterest);
const activationBusy=new Set();
const promoOption=document.createElement('option');promoOption.value='promotion';promoOption.textContent='Акційні товари';$('#product-filter').append(promoOption);
async function request(url,body){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const data=await response.json();
 if(!response.ok)throw Object.assign(new Error(data.error||'Не вдалося виконати дію.'),{status:response.status});
 return data;
}
function showView(next){
 view=next;
 for(const name of ['overview','orders','products','interest','users','notifications'])$('#'+name).hidden=name!==view;
 if(next==='orders')renderOrders();
 for(const button of document.querySelectorAll('nav [data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
}
function renderProducts(){
 const query=$('#product-search').value.trim().toLocaleLowerCase('uk'),filter=$('#product-filter').value;
 const rows=filterManageProducts(products,query,filter);
 $('#product-result-count').textContent=`${rows.length} комплектацій`;
 const dashboard=safeUrl(account?.dashboardUrl);
 $('#products-list').innerHTML=rows.length?`<table><thead><tr><th>Товар</th><th>Артикул</th><th>Ціна</th><th>На сайті</th><th>Дії</th></tr></thead><tbody>${rows.map(p=>`<tr><td><div class="product-title">${safeUrl(p.image)?`<img src="${escape(safeUrl(p.image))}" alt="" loading="lazy">`:''}<div><b>${escape(p.name)}</b><small>${escape(p.variantName)}${p.image?'':'<br>Фото не знайдено в базі даних'}</small></div></div></td><td>${escape(p.sku)}</td><td class="price">${escape(money(p.price))}</td><td><span class="product-status ${p.active===false?'inactive':'active'}">${p.active===false?'Неактивний':'Активний'}</span><button class="activation-button" data-activation="${escape(p.productId)}" data-active="${p.active===false}" aria-label="${p.active===false?'Активувати':'Деактивувати'} модель ${escape(p.name)}" ${activationBusy.has(p.productId)?'disabled':''}>${activationBusy.has(p.productId)?'Зберігаємо…':p.active===false?'Активувати':'Деактивувати'}</button></td><td class="actions"><button class="editor-open" data-edit-product="${escape(p.productId)}" data-variant="${escape(p.id)}" aria-label="Редагувати ${escape(p.sku)}">Редагувати</button>${p.active===false?'<small>Приховано із сайту</small>':`<a href="/products/${encodeURIComponent(p.slug||p.id)}?variant=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">На сайті ↗</a>`}${dashboard?`<a href="${escape(new URL('products/'+encodeURIComponent(p.productId),dashboard).href)}" target="_blank" rel="noopener">Редагувати в Saleor ↗</a>`:''}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">Товарів за цим запитом немає.</p>';
}
$('#products-list').addEventListener('click',async event=>{
 const button=event.target.closest('[data-activation]');if(!button||button.disabled)return;
 const productId=button.dataset.activation,active=button.dataset.active==='true';
 activationBusy.add(productId);renderProducts();$('#message').textContent='';
 try{
  const saved=await request('/api/manage/activation',{productId,active});
  products=products.map(p=>p.productId===saved.productId?{...p,active:saved.active}:p);
  $('#message').textContent=saved.active?'Модель активована й повернута на сайт.':'Модель та всі її комплектації приховані із сайту. Можна активувати знову.';
 }catch(error){$('#message').textContent=error.message;}
 finally{activationBusy.delete(productId);renderProducts();}
});
function delivery(order){
 if(order.delivery==='pickup')return `Самовивіз · ${order.location==='mamaivtsi'?'Мамаївці':'Магала'}`;
 if(order.delivery!=='nova_poshta')return 'Отримання за погодженням із менеджером';
 const s=order.shipping||{};
 return `Нова пошта · ${s.city||''} · ${s.kind==='address'?`${s.street||''}, ${s.house||''}${s.apartment?', кв. '+s.apartment:''}`:s.warehouse||''}`;
}
function renderOrders(){
 const usage=new Map();for(const {order} of records){const promo=order.pricing?.promotion;if(promo?.confirmation==='applied'){const row=usage.get(promo.code)||{count:0,discount:0};row.count++;row.discount+=order.pricing.discount||0;usage.set(promo.code,row);}}
 let block=$('#promo-usage');if(!block){block=document.createElement('div');block.id='promo-usage';$('#orders-list').before(block);}block.innerHTML=usage.size?'<h3>Застосовані промокоди</h3>'+[...usage].map(([code,r])=>'<p>'+escape(code)+' · '+r.count+' використань · знижки '+escape(money(r.discount))+'</p>').join(''):'';
 const query=$('#order-search').value.trim().toLocaleLowerCase('uk');
 const rows=records.filter(({order:o})=>!query||`${o.id} ${o.customer.name} ${o.customer.phone} ${o.customer.email||''} ${o.lines.map(l=>l.sku||l.name).join(' ')}`.toLocaleLowerCase('uk').includes(query));
 $('#orders-list').innerHTML=rows.length?rows.map(({order:o,notifications})=>{
  const sum=o.pricing?.total??o.lines.reduce((total,line)=>total+(line.unitPrice??0)*line.quantity,0),custom=o.lines.some(l=>l.unitPrice==null);
  const date=new Date(o.createdAt).toLocaleString('uk-UA');
  const notices=Object.entries(notifications||{}).map(([key,state])=>`${key==='email'?'Email':'Telegram'}: ${state.status==='sent'?'надіслано':'очікує надсилання'}`).join(' · ');
  return `<details><summary><div><strong>№ ${escape(o.id.slice(0,8).toUpperCase())}</strong><small>${escape(date)}</small></div><div><b>${escape(o.customer.name)}</b><small>${escape(o.customer.phone)}</small></div><div><strong>${escape(money(sum))}${custom?' + розрахунок':''}</strong><small>${escape(statusLabels[o.status||'received']||'Нове')} · Відкрити деталі ↓</small></div></summary><div class="order-body"><div><h3>Покупець</h3><p>${escape(o.customer.name)}</p><p><a href="tel:${escape(o.customer.phone.replace(/[^+\d]/g,''))}">${escape(o.customer.phone)}</a></p>${o.customer.email?`<p><a href="mailto:${escape(o.customer.email)}">${escape(o.customer.email)}</a></p>`:''}</div><div><h3>Оплата</h3><p>${escape(o.payment?.label||'Узгодити з менеджером')} · Не оплачено</p>${o.pricing?.discount?`<p>Промокод: ${escape(o.pricing.promotion?.code)} · Знижка ${escape(money(o.pricing.discount))}. ${o.pricing.promotion?.confirmation==='applied'?'Знижку застосовано.':o.pricing.promotion?.confirmation==='released'?'Застосування скасовано.':'Потребує підтвердження.'}</p>`:''}<h3>Доставка</h3><p>${escape(delivery(o))}</p>${o.shipping?.verified===false?'<p>Адресу вказано вручну — уточніть перед відправленням.</p>':''}${o.comment?`<p><b>Коментар:</b> ${escape(o.comment)}</p>`:''}<p>${escape(notices)}</p></div><div class="order-lines"><form data-status-form="${escape(o.id)}"><label>Статус замовлення <select name="status">${Object.entries(statusLabels).map(([key,label])=>`<option value="${key}" ${key===(o.status||'received')?'selected':''}>${label}</option>`).join('')}</select></label> <button type="submit">Зберегти статус</button><p role="status"></p></form><p class="reservation-state">${o.commerce&&!o.commerce.released&&!o.commerce.settled?'Товари зарезервовано: '+escape((o.commerce.allocations||[]).map(a=>a.sku+' × '+a.quantity+' ('+(a.location==='mamaivtsi'?'Мамаївці':'Магала')+')').join(', ')||'індивідуальний виріб'):o.commerce?.settled?'Резерв узгоджено з обліком':o.commerce?.released?'Резерв знято':'Товари ще не зарезервовані'}</p>${o.commerce&&!o.commerce.released&&!o.commerce.settled&&['shipped','completed'].includes(o.status)?`<form data-settle-form="${escape(o.id)}"><p>Коли відвантаження відображене в обліковій системі, вкажіть документ для узгодження залишків. Застосований промокод залишається використаним.</p><label>Номер документа обліку <input name="reference" required minlength="3" maxlength="120"></label><button type="submit">Резерв передано в облік</button><p role="status"></p></form>`:o.commerce?.settled?`<p>Резерв узгоджено з обліком: ${escape(o.commerce.accountingReference)}</p>`:''}<h3>Склад замовлення</h3><div class="table-wrap"><table><thead><tr><th>Товар</th><th>Кількість</th><th>За одиницю</th></tr></thead><tbody>${o.lines.map(l=>`<tr><td><b>${escape(l.name)}</b><small>${escape(l.variantName)}<br>${escape(l.sku||'Індивідуальний виріб')}</small></td><td>${l.quantity}</td><td class="price">${escape(money(l.unitPrice))}</td></tr>`).join('')}</tbody></table></div></div></div></details>`;
 }).join(''):'<p class="empty">Замовлень поки немає або вони не відповідають пошуку.</p>';
}
async function load(){
 const version=++revision;$('#message').textContent='Завантаження…';$('#refresh').disabled=true;
 try{
  account=await request('/api/manage/me');if(version!==revision)return;
  interestButton.disabled=!account.canInterest;
  usersButton.disabled=!account.canInterest;noticesButton.disabled=!account.canOrders;
  $('#login-panel').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;
  $('#identity').textContent=account.user.firstName||account.user.email;
  $('#dashboard-link').href=safeUrl(account.dashboardUrl)||'#';
  for(const button of document.querySelectorAll('[data-view="orders"]'))button.disabled=!account.canOrders;
  for(const button of document.querySelectorAll('[data-view="products"]'))button.disabled=!account.canProducts;
  const results=await Promise.allSettled([account.canOrders?request('/api/manage/orders'):Promise.resolve({records:[]}),account.canProducts?request('/api/manage/catalog'):Promise.resolve({products:[]})]);
  if(version!==revision)return;
  records=results[0].status==='fulfilled'?results[0].value.records:[];products=results[1].status==='fulfilled'?results[1].value.products:[];
  $('#order-count').textContent=account.canOrders&&results[0].status==='fulfilled'?records.length:'—';
  $('#model-count').textContent=account.canProducts&&results[1].status==='fulfilled'?new Set(products.map(p=>p.productId)).size:'—';
  $('#variant-count').textContent=products.length;$('#photo-count').textContent=products.filter(p=>!p.image).length;
  renderOrders();renderProducts();
  renderNotifications();users=[];renderUsers();if(account.canInterest){try{const data=await request('/api/manage/users');if(version===revision){users=data.users;renderUsers();}}catch(error){$('#users-list').textContent=error.message;}}
  interest=null;renderInterest();if(account.canInterest){try{const data=await request('/api/manage/interest');if(version===revision){interest=data;renderInterest();}}catch(error){$('#interest-ranking').textContent=error.message;}}
  $('#message').textContent=results.filter(r=>r.status==='rejected').map(r=>r.reason.message).join(' ');
 }catch(error){if(version!==revision)return;$('#workspace').hidden=true;$('#logout').hidden=true;$('#login-panel').hidden=false;$('#login-message').textContent=error.status===401?'':error.message;}
 finally{if(version===revision)$('#refresh').disabled=false;}
}
$('#login-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;$('#login-message').textContent='Вхід…';
 try{await request('/api/auth/login',{email:form.email.value,password:form.password.value});form.password.value='';await load();}catch(error){$('#login-message').textContent=error.message;}finally{button.disabled=false;}
});
$('#logout').addEventListener('click',async()=>{try{await request('/api/auth/logout',{});revision++;records=[];products=[];interest=null;$('#interest-customers').innerHTML='';$('#interest-ranking').innerHTML='';$('#orders-list').innerHTML='';$('#products-list').innerHTML='';$('#workspace').hidden=true;$('#logout').hidden=true;$('#login-panel').hidden=false;$('#login-message').textContent='';}catch(error){$('#message').textContent=error.message;}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(!button||button.disabled)return;if(button.dataset.missing){$('#product-filter').value=button.dataset.missing;renderProducts();}showView(button.dataset.view);});
globalThis.VSMarketManage={request,products:()=>products,refreshCatalog:async()=>{const result=await request('/api/manage/catalog');products=result.products;$('#model-count').textContent=new Set(products.map(p=>p.productId)).size;$('#variant-count').textContent=products.length;$('#photo-count').textContent=products.filter(p=>!p.image).length;renderProducts();}};
$('#refresh').addEventListener('click',load);$('#product-search').addEventListener('input',renderProducts);$('#product-filter').addEventListener('change',renderProducts);$('#order-search').addEventListener('input',renderOrders);
load();

$('#orders-list').addEventListener('submit',async event=>{const form=event.target.closest('[data-status-form]');if(!form)return;event.preventDefault();const row=records.find(r=>r.order.id===form.dataset.statusForm),button=form.querySelector('button'),note=form.querySelector('[role="status"]');button.disabled=true;note.textContent='Зберігаємо…';try{const saved=await request('/api/manage/order-status',{id:row.order.id,status:form.elements.status.value,expectedStatus:row.order.status||'received'});Object.assign(row.order,saved);note.textContent=saved.status==='confirmed'?'Підтверджено: резерв збережено, промокод застосовано за наявності. Оновіть список для деталей.':'Збережено. Покупець бачить цей статус у кабінеті.';const small=form.closest('details').querySelector('summary div:last-child small');small.textContent=statusLabels[saved.status]+' · Відкрити деталі ↓';}catch(error){note.textContent=error.message;}finally{button.disabled=false;}});

$('#orders-list').addEventListener('submit',async event=>{const form=event.target.closest('[data-settle-form]');if(!form)return;event.preventDefault();const button=form.querySelector('button'),note=form.querySelector('[role="status"]');button.disabled=true;try{const saved=await request('/api/manage/order-settlement',{id:form.dataset.settleForm,reference:form.elements.reference.value});Object.assign(records.find(r=>r.order.id===saved.id).order,saved);note.textContent='Резерв узгоджено з обліком. Промокод залишається використаним.';}catch(error){note.textContent=error.message;}finally{button.disabled=false;}});
