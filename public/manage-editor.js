(()=>{
 const editor=document.querySelector('#product-editor'),$=selector=>editor.querySelector(selector);
 let data=null,busy=false,opener,openRevision=0;
 const field=(form,name)=>form.elements.namedItem(name);
 const mediaForm=document.createElement('form');mediaForm.id='editor-photos';mediaForm.innerHTML='<h3>Фотографії цієї комплектації</h3><p>Перше фото — головне. Посилання з нового рядка, до 12 фото.</p><textarea name="photos" rows="5" style="width:100%"></textarea><label>Завантажити PNG або JPEG до 1 МБ<input type="file" name="upload" accept="image/png,image/jpeg" multiple></label><label><input type="checkbox" name="useSource"> Використовувати фото з імпорту</label><button type="submit">Зберегти фото</button><p class="editor-status" role="status"></p>';
 const promotionForm=document.createElement('form');promotionForm.id='editor-promotion';promotionForm.innerHTML='<h3>Акція для цієї комплектації</h3><p>Ціна діє в каталозі й замовленні до вимкнення акції тут.</p><label><input type="checkbox" name="enabled"> Акція активна</label><label>Назва акції<input name="label" maxlength="100" value="Акція"></label><label>Акційна ціна, грн<input type="number" name="price" min="0.01" step="0.01"></label><p id="promotion-original"></p><button type="submit">Зберегти акцію</button><p class="editor-status" role="status"></p>';
 $('#editor-sections').append(mediaForm,promotionForm);
 field(mediaForm,'upload').addEventListener('change',async()=>{const status=mediaForm.querySelector('.editor-status');try{for(const file of field(mediaForm,'upload').files){if(file.size>1024*1024)throw new Error('Фото має бути до 1 МБ.');const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const result=await VSMarketManage.request('/api/manage/shop-image',{data:encoded});field(mediaForm,'photos').value+=(field(mediaForm,'photos').value.trim()?'\n':'')+result.url;}status.textContent='Фото завантажено. Натисніть «Зберегти фото».';}catch(e){status.textContent=e.message;}});
 const forms=[...editor.querySelectorAll('form')];
 const money=value=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value)+' грн';
 function descriptionNote(){
  const form=$('#editor-model'),has=field(form,'description').value.trim().length>0;
  $('#editor-description-note').textContent=has?'Опис показуватиметься на сторінці моделі.':'Опис у Saleor ще не додано. Введіть його та збережіть.';
 }
 const statuses=()=>forms.forEach(form=>{const status=form.querySelector('.editor-status');status.textContent='';status.classList.remove('success');});
 function priceMode(){const form=$('#editor-price'),source=field(form,'mode').value==='source';field(form,'price').readOnly=source;field(form,'price').classList.toggle('editor-readonly',source);if(source)field(form,'price').value=data.sourcePrice??data.price;else field(form,'price').value=data.price;}
 function fill(value){
  data=value;const rec=$('#editor-recommendations');for(const kind of ['cross','upsell'])for(let i=0;i<3;i++){const row=value.recommendations?.[kind]?.[i];field(rec,kind+'Sku'+i).value=row?.sku||'';field(rec,kind+'Reason'+i).value=row?.reason||'';}field(rec,'confirmCompatibility').checked=false;const list=$('#recommendation-skus');list.replaceChildren();for(const p of VSMarketManage.products()){if(p.sku===value.sku)continue;const option=document.createElement('option');option.value=p.sku;option.label=p.name+' · '+p.variantName;list.append(option);}const model=$('#editor-model'),specs=$('#editor-specifications'),price=$('#editor-price');
  $('#editor-title').textContent=value.name;$('#editor-sku').textContent='Артикул: '+value.sku+' · '+value.variantName;
  field(mediaForm,'photos').value=(value.photos||[]).map(p=>p.url).join('\n');field(mediaForm,'useSource').checked=false;field(promotionForm,'enabled').checked=!!value.promotion;field(promotionForm,'label').value=value.promotion?.label||'Акція';field(promotionForm,'price').value=value.price;$('#promotion-original').textContent='Звичайна ціна: '+money(value.promotion?.originalPrice||value.price);
  field(model,'name').value=value.name;field(model,'description').value=value.description;
  descriptionNote();$('#editor-source-description').hidden=!value.sourceDescription;$('#editor-source-description-text').textContent=value.sourceDescription||'';
  for(const key of ['width','height','color','opening','opening_direction','type']){const spec=value.specifications.find(item=>key==='type'?['construction_type','product_type'].includes(item.key):item.key===key);field(specs,key).value=spec?.value||'';}
  field(price,'mode').value=value.priceMode;field(price,'mode').querySelector('[value="source"]').disabled=value.sourcePrice==null;
  if(value.sourcePrice==null)field(price,'mode').value='manual';
  $('#editor-source-price').textContent=value.sourcePrice==null?'Ціна з прайсу зараз недоступна.':'Поточна ціна з прайсу: '+money(value.sourcePrice);
  priceMode();$('#editor-sections').hidden=false;$('#editor-loading').hidden=true;
 }
 function close(){if(busy)return;openRevision++;editor.close();data=null;const target=[...document.querySelectorAll('[data-edit-product]')].find(button=>button.dataset.editProduct===opener?.dataset.editProduct&&button.dataset.variant===opener?.dataset.variant);(target||opener)?.focus();}
 $('#editor-close').addEventListener('click',close);
 editor.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('#editor-price').addEventListener('change',event=>{if(event.target.name==='mode')priceMode();});
 $('#editor-model').addEventListener('input',event=>{if(event.target.name==='description')descriptionNote();});
 $('#editor-use-source-description').addEventListener('click',()=>{if(busy||!data?.sourceDescription)return;field($('#editor-model'),'description').value=data.sourceDescription;descriptionNote();$('#editor-description-note').textContent='Текст підставлено з бази обліку. Перевірте й збережіть його для всієї моделі.';field($('#editor-model'),'description').focus();});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-edit-product]');if(!button||button.disabled)return;
  const revision=++openRevision;opener=button;statuses();data=null;$('#editor-sections').hidden=true;$('#editor-loading').hidden=false;$('#editor-loading').textContent='Завантаження…';editor.showModal();
  try{const saved=await VSMarketManage.request('/api/manage/product?'+new URLSearchParams({productId:button.dataset.editProduct,variantId:button.dataset.variant}));if(revision===openRevision)fill(saved);}catch(error){if(revision===openRevision)$('#editor-loading').textContent=error.message;}
 });
 forms.forEach(form=>form.addEventListener('submit',async event=>{
  event.preventDefault();if(!data||busy)return;
  const section=form.id.replace('editor-',''),status=form.querySelector('.editor-status'),payload={productId:data.productId,variantId:data.variantId,section};
  if(section==='model'){payload.name=field(form,'name').value;payload.description=field(form,'description').value;}
  if(section==='photos'){payload.photos=field(form,'photos').value.split('\n').map(s=>s.trim()).filter(Boolean);payload.useSource=field(form,'useSource').checked;}
  if(section==='promotion'){payload.enabled=field(form,'enabled').checked;payload.label=field(form,'label').value;payload.price=Number(field(form,'price').value);}
  if(section==='specifications')payload.specifications=Object.fromEntries(['width','height','color','opening','opening_direction','type'].map(key=>[key,field(form,key).value]));
  if(section==='recommendations'){payload.confirmCompatibility=field(form,'confirmCompatibility').checked;payload.recommendations={};for(const kind of ['cross','upsell'])payload.recommendations[kind]=Array.from({length:3},(_,i)=>({sku:field(form,kind+'Sku'+i).value.trim(),reason:field(form,kind+'Reason'+i).value.trim()})).filter(row=>row.sku||row.reason);}
  if(section==='price'){payload.mode=field(form,'mode').value;payload.price=Number(field(form,'price').value);}
  busy=true;editor.querySelectorAll('button').forEach(button=>button.disabled=true);status.classList.remove('success');status.textContent='Зберігаємо…';
  try{
   const saved=await VSMarketManage.request('/api/manage/edit',payload);data=saved;
   // Preserve unsaved edits in the other sections of this dialog.
   $('#editor-title').textContent=saved.name;$('#editor-sku').textContent='Артикул: '+saved.sku+' · '+saved.variantName;if(section==='price'){$('#editor-source-price').textContent=saved.sourcePrice==null?'Ціна з прайсу зараз недоступна.':'Поточна ціна з прайсу: '+money(saved.sourcePrice);}
   try{await VSMarketManage.refreshCatalog();status.textContent='Збережено.';}catch{status.textContent='Зміни збережено. Оновіть список товарів, щоб побачити їх.';}status.classList.add('success');
  }catch(error){status.textContent=error.message;}
  finally{busy=false;editor.querySelectorAll('button').forEach(button=>button.disabled=false);}
 }));
})();
