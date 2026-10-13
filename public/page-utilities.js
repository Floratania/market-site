(()=>{
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14"/></svg>';
const adjustments='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>';
const closeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
const backToTop=document.createElement('button');
backToTop.type='button';backToTop.className='back-to-top';backToTop.setAttribute('aria-label','Повернутися вгору');backToTop.innerHTML=arrow;backToTop.hidden=true;document.body.append(backToTop);
const updateTop=()=>{backToTop.hidden=window.scrollY<400;};
window.addEventListener('scroll',updateTop,{passive:true});updateTop();
backToTop.addEventListener('click',()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.querySelector('.site-header .brand')?.focus({preventScroll:true});});
const trigger=document.querySelector('#filter-toggle'),panel=document.querySelector('#catalog-filters');
if(trigger&&panel){
 const mobile=matchMedia('(max-width:760px)'),types=document.querySelector('#construction-types');
 const anchor=document.createElement('span');anchor.hidden=true;if(types)types.before(anchor);
 trigger.innerHTML=`${adjustments}<span>Фільтри</span>`;trigger.setAttribute('aria-controls','catalog-filters');
 const close=document.createElement('button');close.type='button';close.className='mobile-filter-close';close.setAttribute('aria-label','Закрити фільтри');close.innerHTML=closeIcon;
 panel.querySelector('.filter-heading').append(close);
 const apply=document.createElement('button');apply.type='button';apply.className='mobile-filter-apply';apply.textContent='Показати товари';panel.append(apply);
 const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='mobile-filter-backdrop';backdrop.hidden=true;backdrop.setAttribute('aria-label','Закрити панель фільтрів');backdrop.tabIndex=-1;document.body.append(backdrop);
 let open=false,previousOverflow='';
 const setOpen=value=>{
  value=Boolean(value&&mobile.matches);if(value===open)return;
  open=value;panel.classList.toggle('open',open);trigger.setAttribute('aria-expanded',String(open));backdrop.hidden=!open;
  if(open){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');close.focus();}
  else{document.body.style.overflow=previousOverflow;panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(mobile.matches)trigger.focus({preventScroll:true});}
 };
 const responsive=()=>{
  setOpen(false);
  if(types){if(mobile.matches)panel.querySelector('.filter-heading').after(types);else anchor.after(types);}
  trigger.classList.toggle('mobile-filter-trigger',mobile.matches&&location.pathname.replace(/\/$/,'')==='/catalog');
 };
 mobile.addEventListener('change',responsive);responsive();
 trigger.addEventListener('click',()=>setOpen(!open));close.addEventListener('click',()=>setOpen(false));apply.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',event=>{
  if(!open)return;
  if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
  if(event.key==='Tab'){
   const focusable=[...panel.querySelectorAll('button,input,select,summary,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length),first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
 });
}
})();
