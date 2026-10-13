(async()=>{
  const shop=globalThis.VSMarketShop;
  if(!shop||!document.querySelector('#checkout-page'))return;
  const el=id=>document.getElementById(id),form=el('order-form');
  const field=name=>form.elements.namedItem(name);
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money=value=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
  let activePromo=null,promoFingerprint='',promoRevision=0;
  const cartPayload=()=>shop.cartLines().map(({product,quantity})=>product.customDesign?{customDesign:product.customDesign,quantity}:{sku:product.sku,quantity});
  const fingerprint=()=>JSON.stringify(cartPayload());
  let lines=[],cityRef='',warehouseRef='',cityRevision=0,warehouseRevision=0,cityTimer,warehouseTimer,accepting=false;
  let requestId;try{requestId=sessionStorage.getItem('vsmarket-order-request-id');}catch{}
  if(!requestId){requestId=crypto.randomUUID();try{sessionStorage.setItem('vsmarket-order-request-id',requestId);}catch{}}
  const status=(text)=>{el('order-status').textContent=text;};
  const read=async url=>{const response=await fetch(url);const data=await response.json();if(!response.ok)throw new Error(data.error||'Не вдалося завантажити дані');return data;};
  function options(target,items,select) {
    target.replaceChildren();
    for(const item of items){const button=document.createElement('button');button.type='button';button.role='option';button.textContent=item.label||item.name;button.addEventListener('click',()=>{select(item);target.hidden=true;target.previousElementSibling.setAttribute('aria-expanded','false');});target.append(button);}
    target.hidden=!items.length;target.previousElementSibling.setAttribute('aria-expanded',String(Boolean(items.length)));
  }
  function clearOptions(id){el(id).hidden=true;el(id).previousElementSibling.setAttribute('aria-expanded','false');}
  async function searchCities(){
    const revision=++cityRevision,q=field('city').value.trim();
    if(q.length<2){clearOptions('nova-city-options');return;}
    try {const result=await read('/api/nova-poshta/cities?q='+encodeURIComponent(q));if(revision!==cityRevision)return;options(el('nova-city-options'),result.items,item=>{field('city').value=item.name;cityRef=item.ref;warehouseRef='';field('warehouse').value='';clearOptions('nova-warehouse-options');searchWarehouses();});el('nova-status').textContent=result.items.length?'Оберіть населений пункт зі списку.':'Населений пункт не знайдено. Можна вказати адресу вручну.';}
    catch(error){if(revision===cityRevision){clearOptions('nova-city-options');el('nova-status').textContent=error.message;}}
  }
  async function searchWarehouses(){
    const revision=++warehouseRevision;if(!cityRef||field('novaKind').value!=='branch')return;
    try {const result=await read('/api/nova-poshta/warehouses?cityRef='+encodeURIComponent(cityRef)+'&q='+encodeURIComponent(field('warehouse').value.trim()));if(revision!==warehouseRevision)return;options(el('nova-warehouse-options'),result.items,item=>{field('warehouse').value=item.name;warehouseRef=item.ref;el('nova-status').textContent='Відділення обрано. Менеджер перевірить можливість відправлення вашого виробу.';});if(!result.items.length)el('nova-status').textContent='Відділення не знайдено. Вкажіть номер та адресу вручну — менеджер уточнить доставку.';}
    catch(error){if(revision===warehouseRevision){clearOptions('nova-warehouse-options');el('nova-status').textContent=error.message;}}
  }
  function deliveryFields(){
    const method=field('delivery').value;for(const [name,allowed] of [['cod',method==='nova_poshta'],['cash_pickup',method==='pickup']]){const input=form.querySelector('[name="paymentMethod"][value="'+name+'"]');input.disabled=!allowed;if(!allowed&&input.checked)form.querySelector('[name="paymentMethod"][value="bank_transfer"]').checked=true;}const branch=field('novaKind').value==='branch';
    el('nova-fields').hidden=method!=='nova_poshta';el('order-pickup-fields').hidden=method!=='pickup';el('nova-warehouse-field').hidden=!branch;el('nova-address-fields').hidden=branch;
    field('city').required=method==='nova_poshta';field('warehouse').required=method==='nova_poshta'&&branch;field('street').required=method==='nova_poshta'&&!branch;field('house').required=method==='nova_poshta'&&!branch;field('location').required=method==='pickup';
    clearOptions('nova-city-options');clearOptions('nova-warehouse-options');
    el('order-shipping-label').textContent=method==='nova_poshta'?'За тарифами перевізника':method==='pickup'?'Самовивіз':'Узгодимо з менеджером';
    el('nova-status').textContent=!branch?'Вкажіть адресу кур’єрської доставки.':warehouseRef?'Відділення обрано. Менеджер перевірить можливість відправлення вашого виробу.':'Оберіть місто та відділення зі списку або вкажіть їх вручну.';
    if(method==='pickup'){
      const stock=shop.stock(),place=field('location').value;
      const missing=place?lines.filter(line=>!line.product.customDesign&&Number(stock.items.find(item=>item.sku===line.product.sku&&item.location===place)?.quantity||0)<line.quantity):[];
      el('order-pickup-status').textContent=lines.some(line=>line.product.customDesign)?'Індивідуальні вироби виготовляються за погодженням. Оберіть допомогу з доставкою.':!place?'Оберіть склад для самовивозу.':!stock.verified?'Актуальну наявність і час самовивозу підтвердить менеджер.':missing.length?'Для частини товарів недостатньо залишку. Змініть склад або узгодьте отримання з менеджером.':'Товари є на обраному складі. Менеджер підтвердить час отримання.';
    }
  }
  function render(){
    lines=shop.cartLines();el('checkout-loading').hidden=true;el('checkout-empty').hidden=Boolean(lines.length);el('checkout-layout').hidden=!lines.length;
    el('order-items').innerHTML=lines.map(({product,quantity})=>`<article class="order-line"><div class="order-line-photo">${/^https?:\/\//.test(product.image||'')?`<img src="${escape(product.image)}" alt="">`:'VS'}</div><div><h3>${product.customDesign ? escape(product.name) : `<a href="${escape(shop.productUrl(product))}">${escape(product.name)}</a>`}</h3><p>${escape(product.variantName||product.sku||'Індивідуальний виріб')}</p><p>${quantity} шт.</p><strong>${product.price==null?'За розрахунком':money(product.price*quantity)}</strong></div></article>`).join('');
    if(activePromo&&promoFingerprint!==fingerprint()){activePromo=null;el('promo-status').textContent='Кошик змінився. Застосуйте промокод повторно.';}
    const total=lines.reduce((sum,line)=>sum+(line.product.price||0)*line.quantity,0)-(activePromo?.discount||0);
    el('order-discount-row').hidden=!activePromo;el('order-discount-value').textContent=activePromo?'− '+money(activePromo.discount):'';
    el('order-total-value').textContent=lines.some(line=>line.product.price==null)?(total?money(total)+' + за розрахунком':'За розрахунком'):money(total);
    deliveryFields();
  }
  el('apply-promo').addEventListener('click',async()=>{
    const code=el('order-promo').value.trim(),revision=++promoRevision;activePromo=null;
    if(!code){el('promo-status').textContent='Промокод прибрано.';render();return;}
    const before=fingerprint();el('apply-promo').disabled=true;el('promo-status').textContent='Перевіряємо промокод…';
    try{const response=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:cartPayload(),promoCode:code,email:field('email').value})}),data=await response.json();if(!response.ok)throw new Error(data.error||'Не вдалося перевірити промокод.');if(revision!==promoRevision||before!==fingerprint())return;activePromo=data.promotion;promoFingerprint=before;el('order-promo').value=activePromo.code;el('promo-status').textContent='Знижка '+money(activePromo.discount)+'. Її остаточно підтвердить менеджер.';render();}
    catch(error){if(revision===promoRevision){activePromo=null;el('promo-status').textContent=error.message;render();}}
    finally{el('apply-promo').disabled=false;}
  });
  const resetPromo=()=>{promoRevision++;activePromo=null;el('promo-status').textContent=el('order-promo').value.trim()?'Застосуйте код для перевірки знижки.':'';render();};
  el('order-promo').addEventListener('input',resetPromo);field('email').addEventListener('input',resetPromo);
  el('proposal-button').addEventListener('click',()=>{try{sessionStorage.setItem('vsmarket-proposal-context',JSON.stringify({promoCode:activePromo?.code||'',email:field('email').value,recipient:field('name').value}));}catch{}location.assign('/proposal?from=checkout');});
  field('city').addEventListener('input',()=>{cityRef='';warehouseRef='';field('warehouse').value='';cityRevision++;warehouseRevision++;clearOptions('nova-warehouse-options');clearTimeout(cityTimer);cityTimer=setTimeout(searchCities,350);});
  field('warehouse').addEventListener('input',()=>{warehouseRef='';warehouseRevision++;clearTimeout(warehouseTimer);warehouseTimer=setTimeout(searchWarehouses,350);});
  field('warehouse').addEventListener('focus',()=>{if(cityRef)searchWarehouses();});
  form.addEventListener('change',event=>{if(['delivery','novaKind','location'].includes(event.target.name))deliveryFields();});
  document.addEventListener('click',event=>{if(!event.target.closest('#nova-city-options')&&event.target!==field('city'))clearOptions('nova-city-options');if(!event.target.closest('#nova-warehouse-options')&&event.target!==field('warehouse'))clearOptions('nova-warehouse-options');});
  for(const [input,list] of [[field('city'),el('nova-city-options')],[field('warehouse'),el('nova-warehouse-options')]])input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&!list.hidden){event.preventDefault();list.querySelector('button')?.focus();}if(event.key==='Escape'){clearOptions(list.id);}});
  for(const list of [el('nova-city-options'),el('nova-warehouse-options')])list.addEventListener('keydown',event=>{if(event.key==='Escape'){clearOptions(list.id);list.previousElementSibling.focus();}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const buttons=[...list.querySelectorAll('button')],index=buttons.indexOf(document.activeElement),next=(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(shop.isDemo){status('Це демонстраційний перегляд. Замовлення не надсилаються.');return;}if(!accepting){status('Оформлення тимчасово недоступне. Зателефонуйте нам: +380 66 670 97 77.');return;}
    render();if(!lines.length)return;
    const delivery=field('delivery').value;
    const shipping=delivery==='nova_poshta'?{kind:field('novaKind').value,city:field('city').value,warehouse:field('warehouse').value,street:field('street').value,house:field('house').value,apartment:field('apartment').value,...(cityRef&&warehouseRef&&field('novaKind').value==='branch'?{cityRef,warehouseRef}:{})}:null;
    if(el('order-promo').value.trim()&&(!activePromo||activePromo.code!==el('order-promo').value.trim())){status('Спочатку застосуйте промокод або очистіть поле.');return;}
    const payload={paymentMethod:field('paymentMethod').value,promoCode:activePromo?.code||'',expectedDiscount:activePromo?.discount||0,requestId,name:field('name').value,phone:field('phone').value,email:field('email').value,delivery,shipping,location:field('location').value,comment:field('comment').value,consent:field('consent').checked,lines:lines.map(({product,quantity})=>product.customDesign?{customDesign:product.customDesign,quantity}:{sku:product.sku,quantity,expectedPrice:product.price})};
    el('order-submit').disabled=true;status('Перевіряємо ціни й наявність та зберігаємо замовлення…');
    try{const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();if(!response.ok)throw new Error(result.error||'Не вдалося оформити замовлення');shop.clearCart();el('checkout-layout').hidden=true;el('checkout-empty').hidden=true;el('checkout-success').hidden=false;el('checkout-order-number').textContent='Ваше замовлення № '+result.id.slice(0,8).toUpperCase();el('checkout-success').focus();try{sessionStorage.removeItem('vsmarket-order-request-id');}catch{}}
    catch(error){status(error.message);}
    finally{el('order-submit').disabled=!accepting;}
  });
  try{await shop.ready;render();
    if(!shop.isDemo){try{const account=await read('/api/auth/me');if(account.user){const user=account.user;field('name').value=[user.firstName,user.lastName].filter(Boolean).join(' ');field('email').value=user.email||'';field('phone').value=user.phone||'';}}catch{}}
    const config=await read('/api/checkout');accepting=config.acceptingOrders&&!shop.isDemo;el('order-submit').disabled=!accepting;if(!accepting)status(shop.isDemo?'Демонстраційний перегляд. Замовлення не надсилаються.':'Оформлення тимчасово недоступне. Ми допоможемо телефоном: +380 66 670 97 77.');}
  catch{el('checkout-loading').textContent='Не вдалося завантажити кошик. Спробуйте оновити сторінку.';}
  document.addEventListener('vsmarket-cart-change',()=>{if(el('checkout-success').hidden)render();});
})();
