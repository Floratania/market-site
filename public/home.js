(() => {
  if(location.pathname!=='/')return;
  const shop=globalThis.VSMarketShop,form=document.querySelector('#configurator-form');if(!shop||!form)return;
  const field=name=>form.elements.namedItem(name),preview=document.querySelector('#constructor-preview'),summary=document.querySelector('#constructor-summary'),status=document.querySelector('#constructor-status'),add=document.querySelector('#constructor-add'),ready=document.querySelector('#constructor-ready');
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function socialIcon(url){
    const host=new URL(url).hostname.toLowerCase().replace(/^www\./,'');
    const svg=(content,brand)=>`<svg class="social-icon" data-social-icon="${brand}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
    if(host==='facebook.com')return svg('<path fill="currentColor" d="M14 22v-9h3l.5-4H14V6.5c0-1 .3-1.5 1.6-1.5H18V1.4A25 25 0 0 0 14.5 1C11 1 9 3.1 9 6.7V9H6v4h3v9z"/>','facebook');
    if(host==='instagram.com')return svg('<g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"/>','instagram');
    if(host==='tiktok.com')return svg('<path fill="currentColor" d="M15.6 2H12v13.4a3 3 0 1 1-2.5-3V8.8a6.6 6.6 0 1 0 6.1 6.6V8.5a8.4 8.4 0 0 0 5.2 1.8V6.7c-2.7 0-5.2-2.2-5.2-4.7z"/>','tiktok');
    return svg('<g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18"/></g>','website');
  }
  let previousKind='window';
  const design=()=>shop.normalizeDesign({kind:field('kind').value,width:Number(field('width').value),height:Number(field('height').value),color:field('color').value,material:field('material').value,opening:field('opening').value,sections:field('kind').value==='door'?1:Number(field('sections').value)});
  function sketch(d){
    const factor=340/Math.max(d.width,d.height),w=d.width*factor,h=d.height*factor,x=(520-w)/2,y=(430-h)/2+8,frame=Math.min(12,w*.07,h*.07),finish={white:'#f8f8f5',anthracite:'#3b4148','golden-oak':'#ad763e',walnut:'#624333'}[d.color];
    let drawing=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${finish}" stroke="#697078" stroke-width="1.5" rx="2"/>`;
    if(d.kind==='window'){
      const section=w/d.sections;
      for(let i=0;i<d.sections;i++){
        const sx=x+i*section+frame,sy=y+frame,sw=Math.max(1,section-frame*2),sh=Math.max(1,h-frame*2);
        drawing+=`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#glass)" stroke="#697078" stroke-width="1"/><path d="M${sx+sw*.2} ${sy+sh*.06} L${sx+sw*.7} ${sy+sh*.75}" stroke="#fff" opacity=".45" stroke-width="3"/>`;
        if(d.opening!=='fixed')drawing+=`<path d="M${sx+3} ${sy+3} L${sx+sw-3} ${sy+sh/2} L${sx+3} ${sy+sh-3}" fill="none" stroke="#71838e" stroke-width="1.5" stroke-dasharray="5 4"/><rect x="${sx+sw-6}" y="${sy+sh*.45}" width="3" height="${Math.max(6,sh*.1)}" fill="#616970"/>`;
        if(d.opening==='tilt-turn')drawing+=`<path d="M${sx+3} ${sy+sh-3} L${sx+sw/2} ${sy+3} L${sx+sw-3} ${sy+sh-3}" fill="none" stroke="#71838e" stroke-width="1.5" stroke-dasharray="5 4"/>`;
      }
    }else{
      drawing+=`<rect x="${x+frame}" y="${y+frame}" width="${Math.max(1,w-2*frame)}" height="${Math.max(1,h-2*frame)}" fill="${finish}" stroke="#30383e" stroke-width="2"/>`;
      for(let i=1;i<5;i++)drawing+=`<path d="M${x+frame*1.6} ${y+h*i/5} H${x+w-frame*1.6}" stroke="#000" opacity=".15"/>`;
      const handleX=d.opening==='right'?x+frame*2:x+w-frame*3;
      drawing+=`<rect x="${handleX}" y="${y+h*.48}" width="${Math.max(2,w*.025)}" height="${h*.12}" rx="2" fill="#aeb6ba"/>`;
    }
    return `<svg viewBox="0 0 520 480" aria-hidden="true"><defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#c1d8e5"/><stop offset="1" stop-color="#eaf3f6"/></linearGradient></defs><ellipse cx="260" cy="${y+h+12}" rx="${w*.6}" ry="8" fill="#000" opacity=".08"/>${drawing}<path class="dimension-line" d="M${x} ${y+h+32} H${x+w} M${x} ${y+h+25} V${y+h+39} M${x+w} ${y+h+25} V${y+h+39} M${x+w+28} ${y} V${y+h} M${x+w+21} ${y} H${x+w+35} M${x+w+21} ${y+h} H${x+w+35}"/><text x="260" y="${y+h+58}" text-anchor="middle" font-size="15">${d.width} мм</text><text x="${x+w+40}" y="${y+h/2}" text-anchor="middle" font-size="15" transform="rotate(-90 ${x+w+40} ${y+h/2})">${d.height} мм</text></svg>`;
  }
  function update(){
    if(field('kind').value!==previousKind){
      previousKind=field('kind').value;const door=previousKind==='door';
      field('width').value=door?'900':'1200';field('height').value=door?'2050':'1400';
      field('material').innerHTML=(door?['metal','wood']:['pvc','aluminium']).map(key=>`<option value="${key}">${shop.labels.material[key]}</option>`).join('');
      field('opening').innerHTML=(door?['right','left']:['tilt-turn','turn','fixed']).map(key=>`<option value="${key}">${shop.labels.opening[key]}</option>`).join('');
      document.querySelector('#constructor-sections-field').hidden=door;
    }
    try{
      const d=design();add.disabled=false;status.textContent='';
      const description=`${shop.labels.kind[d.kind]} · ${d.width} × ${d.height} мм · ${shop.labels.color[d.color]} · ${shop.labels.material[d.material]} · ${shop.labels.opening[d.opening]}${d.kind==='window'?` · секцій: ${d.sections}`:''}`;
      preview.innerHTML=sketch(d);preview.setAttribute('aria-label',description);summary.textContent=description;
      ready.href=shop.catalogUrl(d.kind==='window'?'Вікна':'Двері',`${d.width}×${d.height}`);ready.hidden=false;
    }catch(error){add.disabled=true;status.textContent=error.message;ready.hidden=true;}
  }
  form.addEventListener('input',update);form.addEventListener('change',update);
  form.addEventListener('submit',event=>{event.preventDefault();try{shop.addCustomProduct(design());status.textContent='Індивідуальний виріб додано в кошик.';}catch(error){status.textContent=error.message;}});
  update();
  fetch('/api/site',{cache:'no-store'}).then(response=>response.ok?response.json():{socials:[]}).then(({socials=[]})=>{
    const links=socials.filter(item=>{try{return new URL(item.url).protocol==='https:';}catch{return false;}});
    document.querySelector('#social-links').innerHTML=links.map(item=>`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="VS Market у ${esc(item.label)} (нова вкладка)">${socialIcon(item.url)}<span>${esc(item.label)}</span><span class="social-external" aria-hidden="true">↗</span></a>`).join('');
    document.querySelector('#socials').hidden=!links.length;
  }).catch(()=>{});
})();
