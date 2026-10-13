(async()=>{
 const shop=globalThis.VSMarketShop,$=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:2}).format(value);
 $('proposal-print').addEventListener('click',()=>window.print());
 try{
  await shop.ready;const lines=shop.cartLines().map(({product,quantity})=>product.customDesign?{customDesign:product.customDesign,quantity}:{sku:product.sku,quantity});
  if(!lines.length){$('proposal-status').textContent='Кошик порожній. Додайте товари, щоб сформувати пропозицію.';return;}
  let context={};try{if(new URLSearchParams(location.search).get('from')==='checkout')context=JSON.parse(sessionStorage.getItem('vsmarket-proposal-context')||'{}');}catch{}
  const response=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines,promoCode:context.promoCode||'',email:context.email||''})}),quote=await response.json();if(!response.ok)throw new Error(quote.error||'Не вдалося сформувати пропозицію.');
  $('proposal-document').innerHTML=`<div class="proposal-meta"><span>№ ${escape(quote.id.slice(0,8).toUpperCase())}</span><span>${escape(new Date(quote.createdAt).toLocaleString('uk-UA'))}</span></div>${context.recipient?`<p>Для: <strong>${escape(String(context.recipient).slice(0,100))}</strong></p>`:''}<div class="proposal-table-wrap"><table><thead><tr><th>Товар / комплектація</th><th>Кількість</th><th>Ціна</th><th>Сума</th></tr></thead><tbody>${quote.lines.map(line=>`<tr><td><div class="proposal-product"><div class="proposal-photo">${/^https?:\/\//.test(line.image||'')?`<img src="${escape(line.image)}" alt="${escape(line.imageAlt||line.name)}" decoding="async">`:'<span>Фото не знайдено в базі даних</span>'}</div><div><strong>${escape(line.name)}</strong><small>${escape(line.variantName)}</small><small>Артикул: ${escape(line.sku||'Індивідуальний виріб')}</small></div></div></td><td>${line.quantity}</td><td>${line.unitPrice==null?'За розрахунком':money(line.unitPrice)}</td><td>${line.unitPrice==null?'За розрахунком':money(line.unitPrice*line.quantity)}</td></tr>`).join('')}</tbody></table></div><div class="proposal-totals">${quote.discount?`<p><span>Промокод ${escape(quote.promotion.code)}</span><strong>− ${money(quote.discount)}</strong></p>`:''}<p class="proposal-grand-total"><span>Разом${quote.hasUnpriced?' за визначеними цінами':''}</span><strong>${money(quote.total)}</strong></p></div><div class="proposal-terms"><p>Ціни актуальні на дату формування. Наявність, комплектацію та остаточну суму підтвердить менеджер.</p>${quote.hasUnpriced?'<p>Індивідуальні вироби розраховуються окремо та не включені до зазначеної суми.</p>':''}${quote.promotion?'<p>Знижка за промокодом попередньо перевірена; остаточно її підтвердить менеджер.</p>':''}<p>Доставка Новою поштою або самовивіз. Доставка та монтаж розраховуються окремо.</p><p>Оплата: переказ за реквізитами, післяплата або при самовивозі — після погодження замовлення.</p></div>`;
  $('proposal-document').hidden=false;$('proposal-status').hidden=true;const images=[...$('proposal-document').querySelectorAll('img')];
  await Promise.all(images.map(image=>new Promise(resolve=>{
   const failed=()=>{image.parentElement.textContent='Фото не вдалося завантажити';resolve();};
   if(image.complete){if(image.naturalWidth>0)resolve();else failed();return;}
   image.addEventListener('load',resolve,{once:true});image.addEventListener('error',failed,{once:true});
  })));
  $('proposal-print').disabled=false;
 }catch(error){$('proposal-status').textContent=error.message;}
})();
