(() => {
  const link=document.querySelector('#account-link');
  const label=document.querySelector('#account-label');
  const logout=document.querySelector('#header-logout');
  const actions=document.querySelector('.account-actions');
  const params=new URLSearchParams(location.search);
  function showAccount(user){
    const next=location.pathname.startsWith('/account')?params.get('next') || '/catalog':location.pathname+location.search+location.hash;
    if(link){link.href=(user?'/account':'/account/login')+'?next='+encodeURIComponent(next);link.setAttribute('aria-label',user?'Відкрити мій кабінет':'Увійти в кабінет покупця');}
    if(label)label.textContent=user?'Мій кабінет':'Увійти';
    if(logout)logout.hidden=!user;
    actions?.classList.toggle('is-authenticated',Boolean(user));
  }
  function accountCartCount(){
    if(!document.body.classList.contains('account-body'))return;
    try{
      const normal=JSON.parse(localStorage.getItem('vs-market-cart-v1')||'{}'),custom=JSON.parse(localStorage.getItem('vs-market-custom-cart-v1')||'{}');
      const quantities=[...Object.values(normal),...Object.values(custom).map(item=>item?.quantity)];
      const count=document.querySelector('#cart-count');if(count)count.textContent=quantities.reduce((sum,value)=>sum+(Number.isInteger(value)&&value>0?value:0),0);
    }catch{}
  }
  accountCartCount();
  let basketSync;
  window.VSMarketAccountCart=async user=>{
    if(!document.body.classList.contains('account-body'))return;
    if(basketSync){try{await basketSync;}catch{}return window.VSMarketAccountCart(user);}
    basketSync=(async()=>{
      const owner=localStorage.getItem('vs-market-cart-owner');
      if(!user){if(owner){localStorage.removeItem('vs-market-cart-owner');localStorage.setItem('vs-market-cart-v1','{}');localStorage.setItem('vs-market-custom-cart-v1','{}');accountCartCount();}return;}
      const local=JSON.parse(localStorage.getItem('vs-market-cart-v1')||'{}'),custom=JSON.parse(localStorage.getItem('vs-market-custom-cart-v1')||'{}');
      const guest=!owner,lines=Object.entries(local).filter(([,quantity])=>Number.isInteger(quantity)&&quantity>0&&quantity<=999).map(([id,quantity])=>({id,quantity}));
      const merge=guest&&(lines.length||Object.keys(custom).length);
      const response=await fetch('/api/auth/cart',{credentials:'same-origin',cache:'no-store',...(merge?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:user.id,lines,custom,merge:true})}:{})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Не вдалося відновити кошик.');
      localStorage.setItem('vs-market-cart-v1',JSON.stringify(Object.fromEntries(data.lines.map(l=>[l.id,l.quantity]))));localStorage.setItem('vs-market-custom-cart-v1',JSON.stringify(data.custom||{}));localStorage.setItem('vs-market-cart-owner',user.id);accountCartCount();
    })();try{return await basketSync;}finally{basketSync=null;}
  };
  if(link && !location.pathname.startsWith('/account'))link.href='/account/login?next='+encodeURIComponent(location.pathname+location.search+location.hash);
  if(document.body.classList.contains('account-body')){
    const theme=document.querySelector('#theme-toggle');
    const icon=document.querySelector('#theme-icon');
    const update=()=>{const dark=document.documentElement.dataset.theme==='dark';document.querySelector('#brand-favicon')?.setAttribute('href',`/assets/brand-cart-${dark?'dark':'light'}.png`);if(icon)icon.src=`/assets/icons/${dark?'sun':'moon'}.svg`;if(theme)theme.setAttribute('aria-label',dark?'Увімкнути світлу тему':'Увімкнути темну тему');};
    theme?.addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('vs-market-theme',document.documentElement.dataset.theme);}catch{}update();});
    update();
  }
  const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
  window.customerReady=fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})
    .then(async response=>{if(!response.ok)throw new Error('Account service unavailable');return response.json();})
    .then(({user})=>{
      showAccount(user);
      window.VSMarketAccountCart(user).catch(problem=>{const note=document.querySelector('#account-status');if(note)note.textContent=problem.message;});
      if(user){const name=document.querySelector('#lead-form [name="name"]');if(name && !name.value)name.value=[user.firstName,user.lastName].filter(Boolean).join(' ');}
      return user;
    }).catch(()=>undefined);
  window.customerReady.then(user=>{if(user!==undefined)return window.VSMarketSelections?.connect(user);});
  let refreshing;
  function refreshCustomer(){
    if(refreshing)return refreshing;
    refreshing=fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(async response=>{
      if(!response.ok)return;
      const {user}=await response.json();
      showAccount(user);
      await window.VSMarketSelections?.connect(user);
      await window.VSMarketAccountCart(user);
    }).catch(()=>{}).finally(()=>{refreshing=null;});return refreshing;
  }
  window.addEventListener('focus',refreshCustomer);
  window.addEventListener('storage',event=>{if(event.key==='vs-market-account-change')void refreshCustomer();if(event.key==='vs-market-cart-v1'||event.key==='vs-market-custom-cart-v1')accountCartCount();});
  logout?.addEventListener('click',async()=>{
    logout.disabled=true;
    try{
      await window.VSMarketSelections?.sync();
      await window.VSMarketShop?.syncCart?.();
      const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
      if(!response.ok)throw new Error('Не вдалося вийти. Спробуйте ще раз.');
      await window.VSMarketSelections?.connect(null);showAccount(null);
      await window.VSMarketShop?.syncCart?.();
      try{localStorage.setItem('vs-market-account-change',crypto.randomUUID());}catch{}
      if(location.pathname.startsWith('/account'))location.assign('/account/login?next='+encodeURIComponent(params.get('next')||'/catalog'));
    }catch(problem){
      const status=document.querySelector('#selection-status')||document.querySelector('#account-status');
      if(status){status.textContent=problem.message||'Не вдалося вийти. Спробуйте ще раз.';status.hidden=false;}
    }finally{logout.disabled=false;}
  });
})();
