(() => {
 const content=document.querySelector('#account-content');
 const params=new URLSearchParams(location.search);
 const path=location.pathname.replace(/\/$/,'');
 const esc=value=>String(value || '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 let next='/catalog';
 const requestedNext=params.get('next');
 if(requestedNext?.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\')){
  const candidate=new URL(requestedNext,location.origin);
  if(candidate.origin===location.origin && !candidate.pathname.startsWith('/account') && !candidate.pathname.startsWith('/api/'))next=candidate.pathname+candidate.search+candidate.hash;
 }
 const route=name=>`/account/${name}?next=${encodeURIComponent(next)}`;
 const signalAccount=()=>{try{localStorage.setItem('vs-market-account-change',crypto.randomUUID());}catch{}};
 const tokens={email:params.get('email') || '',token:params.get('token') || ''};
 // Confirmation and reset tokens must not remain in browser history or referrers.
 if(tokens.token)history.replaceState(null,'',path+'?next='+encodeURIComponent(next));
 document.querySelectorAll('[data-catalog-link]').forEach(link=>link.href=next);
 function input(name,label,type='text',autocomplete='',extra=''){
  const field=`<input id="field-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${extra}>`;
  return `<label for="field-${name}">${label}${type==='password'?`<span class="account-password">${field}<button class="password-toggle" type="button" data-password="field-${name}" aria-controls="field-${name}" aria-pressed="false">Показати</button></span>`:field}</label>`;
 }
 const emailField=()=>input('email','Електронна адреса','email','email','required maxlength="254" placeholder="you@example.com"');
 const passwordField=(newPassword=false)=>input('password',newPassword?'Пароль':'Ваш пароль','password',newPassword?'new-password':'current-password',`required ${newPassword?'minlength="8" maxlength="128"':'maxlength="1024"'}`);
 const status='<p id="account-status" class="account-status" role="status" aria-live="polite"></p>';
 function shell(title,description,body,tabs=false){
  document.title=title+' — VS Market';
  content.innerHTML=`<p class="eyebrow">ВАШ ПРОСТІР</p><h2 id="account-heading">${esc(title)}</h2><p class="account-description">${esc(description)}</p>${tabs?`<div class="account-tabs"><a href="${esc(route('login'))}" ${path==='/account/login'?'aria-current="page"':''}>Вхід</a><a href="${esc(route('register'))}" ${path==='/account/register'?'aria-current="page"':''}>Реєстрація</a></div>`:''}${body}`;
 }
 async function request(action,body){
  let response,data;
  try{response=await fetch('/api/auth/'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});data=await response.json();}
  catch{throw new Error('Не вдалося з’єднатися. Перевірте інтернет і спробуйте ще раз.');}
  if(!response.ok)throw new Error(data.error || 'Не вдалося виконати дію.');
  if(action==='login')await window.VSMarketAccountCart?.(data.user);
  if(action==='logout')await window.VSMarketAccountCart?.(null);
  return data;
 }
 function bind(action,callback,transform=value=>value){
  const form=content.querySelector('form');
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const message=content.querySelector('#account-status');const button=form.querySelector('[type="submit"]');
   const body=Object.fromEntries(new FormData(form));
   if(body.confirmPassword!==undefined && body.password!==body.confirmPassword){message.textContent='Паролі не збігаються.';return;}
   delete body.confirmPassword;
   button.disabled=true;message.classList.remove('success');message.textContent='Зачекайте…';
   try{const result=await request(action,transform(body));form.querySelectorAll('input[autocomplete="current-password"],input[autocomplete="new-password"]').forEach(field=>field.value='');await callback(result,message,body);}
   catch(problem){message.textContent=problem.message;}
   finally{if(button.isConnected)button.disabled=false;}
  });
 }
 content.addEventListener('click',event=>{
  const button=event.target.closest('[data-password]');if(!button)return;
  const field=document.getElementById(button.dataset.password);const visible=field.type==='password';
  field.type=visible?'text':'password';button.textContent=visible?'Сховати':'Показати';button.setAttribute('aria-pressed',String(visible));
 });
 function success(title,text,button='Увійти',href=route('login')){
  shell(title,text,`<div class="account-success">${esc(text)}</div><a class="primary-link full" href="${esc(href)}">${esc(button)} <img class="ui-icon" src="/assets/icons/arrow-right.svg" alt=""></a>`);
 }
 function login(){
  shell('З поверненням','Увійдіть у свій кабінет VS Market.',`<form class="account-form">${emailField()}${passwordField()}<a class="account-recovery" href="${esc(route('forgot'))}">Забули пароль?</a>${status}<button type="submit" class="primary-button full">Увійти <img class="ui-icon" src="/assets/icons/arrow-right.svg" alt=""></button></form>`,true);
  bind('login',async result=>{await window.customerReady;await window.VSMarketSelections?.connect(result.user);signalAccount();location.assign(next);});
 }
 function register(){
  shell('Створити акаунт','Ваш особистий простір для вибору вікон і дверей.',`<form class="account-form"><div class="account-name-fields">${input('firstName','Ім’я','text','given-name','required maxlength="80"')}${input('lastName','Прізвище','text','family-name','maxlength="80"')}</div>${emailField()}${passwordField(true)}${input('confirmPassword','Повторіть пароль','password','new-password','required minlength="8" maxlength="128"')}<p class="account-note">Щонайменше 8 символів. Використайте літери й цифри.</p>${status}<button type="submit" class="primary-button full">Зареєструватися <img class="ui-icon" src="/assets/icons/arrow-right.svg" alt=""></button></form>`,true);
  bind('register',async(result,_,body)=>{
   if(result.requiresConfirmation){success('Акаунт створено','Перевірте електронну пошту й підтвердьте адресу. Після входу ваші улюблені та порівняння перенесуться в акаунт.');return;}
   const signedIn=await request('login',{email:body.email,password:body.password});
   await window.customerReady;await window.VSMarketSelections?.connect(signedIn.user);signalAccount();location.assign(next);
  });
 }
 function forgot(){
  shell('Забули пароль?','Надішлемо посилання для встановлення нового пароля.',`<form class="account-form">${emailField()}${status}<button type="submit" class="primary-button full">Надіслати посилання</button></form><a class="account-secondary" href="${esc(route('login'))}">Повернутися до входу</a>`);
  bind('password-reset',()=>success('Перевірте пошту','Якщо акаунт із цією адресою існує, ви отримаєте лист для відновлення пароля.'));
 }
 function confirm(){
  if(!tokens.email || !tokens.token){success('Посилання неповне','Відкрийте повне посилання з листа підтвердження.');return;}
  shell('Підтвердьте адресу','Ще один крок — і ваш кабінет буде готовий.',`<form class="account-form">${emailField()}${passwordField()}${status}<button type="submit" class="primary-button full">Підтвердити адресу</button></form>`);
  const field=content.querySelector('[name="email"]');field.value=tokens.email;field.readOnly=true;
  bind('confirm',()=>success('Адресу підтверджено','Ви можете увійти у свій кабінет.'),body=>({...body,token:tokens.token}));
 }
 function reset(){
  if(!tokens.email || !tokens.token){success('Посилання неповне','Запросіть новий лист для відновлення пароля.','Відновити пароль',route('forgot'));return;}
  shell('Новий пароль','Оберіть новий пароль для свого акаунта.',`<form class="account-form">${passwordField(true)}${input('confirmPassword','Повторіть пароль','password','new-password','required minlength="8" maxlength="128"')}${status}<button type="submit" class="primary-button full">Зберегти пароль</button></form>`);
  bind('password-set',()=>success('Пароль змінено','Увійдіть зі своїм новим паролем.'),body=>({...body,...tokens}));
 }
 async function profile(){
  let response,data;
  try{response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});data=await response.json();}
  catch{shell('Мій кабінет','Кабінет тимчасово недоступний. Спробуйте ще раз.',`<a class="primary-link full" href="/account">Спробувати ще раз</a>`);return;}
  if(!response.ok){shell('Мій кабінет',data.error || 'Кабінет тимчасово недоступний.','<a class="primary-link full" href="/account">Спробувати ще раз</a>');return;}
  if(!data.user){location.replace(route('login'));return;}
  const user=data.user;
  if(path==='/account/orders'){await ordersPage();return;}
  shell('Мій кабінет','Раді бачити вас у VS Market.',`<div class="account-identity"><span>Електронна адреса</span><strong>${esc(user.email)}</strong></div><form class="account-form"><div class="account-name-fields">${input('firstName','Ім’я','text','given-name','required maxlength="80"')}${input('lastName','Прізвище','text','family-name','maxlength="80"')}</div>${status}<button type="submit" class="primary-button full">Зберегти зміни</button></form><a class="account-secondary" href="${esc(next)}">Перейти до каталогу →</a><button class="account-logout" id="account-logout" type="button">Вийти з акаунта</button>`);
  const form=content.querySelector('form');form.insertAdjacentHTML('afterbegin',input('phone','Номер телефону','tel','tel','maxlength="30" placeholder="+380 …"'));
  form.querySelector('[name="phone"]').value=user.phone||'';
  content.querySelector('#account-heading').insertAdjacentHTML('afterend','<nav class="account-tabs" aria-label="Мій кабінет"><a href="/account" aria-current="page">Мої дані</a><a href="/account/orders">Мої замовлення</a></nav>');
  content.querySelector('[name="firstName"]').value=user.firstName;content.querySelector('[name="lastName"]').value=user.lastName;
  bind('profile',(_,message)=>{message.classList.add('success');message.textContent='Зміни збережено.';});
  content.querySelector('#account-logout').addEventListener('click',async event=>{
   event.target.disabled=true;
   try{await request('logout',{});await window.VSMarketSelections?.connect(null);signalAccount();location.assign(route('login'));}
   catch(problem){content.querySelector('#account-status').textContent=problem.message;event.target.disabled=false;}
  });
 }
 async function ordersPage(){
  shell('Мої замовлення','Замовлення, оформлені після входу у ваш акаунт.', '<nav class="account-tabs" aria-label="Мій кабінет"><a href="/account">Мої дані</a><a href="/account/orders" aria-current="page">Мої замовлення</a></nav><div id="customer-orders" role="status">Завантаження…</div>');
  const target=content.querySelector('#customer-orders');
  try{
   const response=await fetch('/api/account/orders',{credentials:'same-origin',cache:'no-store'}),data=await response.json();
   if(!response.ok)throw new Error(data.error||'Не вдалося завантажити замовлення.');
   const money=value=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value)+' грн';
   const delivery={pickup:'Самовивіз',nova_poshta:'Нова пошта',manager:'За погодженням із менеджером'};
   target.innerHTML=data.orders.length?data.orders.map(order=>{
    const total=order.lines.reduce((sum,line)=>sum+(line.unitPrice==null?0:line.unitPrice*line.quantity),0),custom=order.lines.some(line=>line.unitPrice==null);
    const date=new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'}).format(new Date(order.createdAt));
    return `<article class="customer-order"><header><strong>Замовлення ${esc(order.id.slice(0,8).toUpperCase())}</strong><span>${esc(date)}</span></header><p class="customer-order-status">${esc(({received:'Нове',confirmed:'Підтверджене',shipped:'Відправлене',completed:'Завершене',cancelled:'Скасоване'})[order.status||'received']||'Нове')}</p><p>${esc(delivery[order.delivery]||'Доставка')}${order.location?' · '+esc({mamaivtsi:'Мамаївці',magala:'Магала'}[order.location]||order.location):''}</p><ul>${order.lines.map(line=>`<li>${line.productUrl?.startsWith('/products/')?`<a href="${esc(line.productUrl)}">${esc(line.name)}</a>`:`<strong>${esc(line.name)}</strong>`}<span>${esc(line.variantName||'')}</span><span>${line.quantity} шт. · ${line.unitPrice==null?'Ціна після розрахунку':money(line.unitPrice)}</span></li>`).join('')}</ul>${order.payment?`<p>Оплата: ${esc(order.payment.label)} · Не оплачено</p>`:''}${order.pricing?.discount?`<p>Промокод ${esc(order.pricing.promotion?.code)}: − ${money(order.pricing.discount)} (${order.pricing.promotion?.confirmation==='applied'?'знижку застосовано':order.pricing.promotion?.confirmation==='released'?'застосування скасовано':'після підтвердження менеджером'})</p>`:''}${order.reserved?'<p>Товари зарезервовано для вашого замовлення.</p>':''}<p class="customer-order-total">${custom?'Товари з визначеною ціною: ':'Сума товарів: '}${money(order.pricing?.total??total)}</p>${custom?'<p class="account-note">Індивідуальні вироби розрахує менеджер.</p>':''}</article>`;
   }).join(''):'<div class="account-success">Поки немає замовлень. Увійдіть у цей акаунт перед оформленням — замовлення з’явиться тут.</div><a class="primary-link full" href="/catalog">Перейти до каталогу →</a>';
  }catch(error){target.textContent=error.message;}
 }
 ({'/account/login':login,'/account/register':register,'/account/forgot':forgot,'/account/confirm':confirm,'/account/reset':reset}[path] || profile)();
})();
