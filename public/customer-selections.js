(() => {
  if(new URLSearchParams(location.search).has('demo'))return;
  const guestKey='vs-market-selections-v1',prefix='vs-market-selections-account-v1:';
  const limits={favorites:250,comparison:4},listeners=new Set();
  const empty=()=>({favorites:[],comparison:[]});
  const clean=value=>Object.fromEntries(Object.entries(limits).map(([key,max])=>[key,[...new Set((Array.isArray(value?.[key])?value[key]:[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<200))].slice(0,max)]));
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}};
  let user=null,data=clean(read(guestKey)),queue=[],busy=null,epoch=0,message='Увійдіть, щоб синхронізувати вибір між пристроями.';
  const copy=()=>clean(data);
  const operationId=()=>globalThis.crypto.randomUUID();
  const tabId=operationId();
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{message='Не вдалося зберегти вибір у браузері. Залиште сторінку відкритою до синхронізації.';return false;}};
  function publish(){
    for(const fn of listeners)fn(copy());
    for(const key of Object.keys(limits)){const count=document.querySelector('#'+key+'-count');if(count)count.textContent=data[key].length;}
    document.querySelectorAll('[data-selection-sync]').forEach(note=>note.textContent=message);
  }
  const pendingPrefix=owner=>prefix+owner+':pending:';
  function pendingKeys(owner){try{return Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)).filter(key=>key?.startsWith(pendingPrefix(owner)));}catch{return [];}}
  function saveQueue(key,operations){try{if(!operations.length){localStorage.removeItem(key);return;}}catch{}save(key,{queue:operations});}
  function persist(){
    if(!user){save(guestKey,copy());return;}
    save(prefix+user.id,copy());saveQueue(pendingPrefix(user.id)+tabId,queue);
  }
  function apply(value,operations){
    const result=clean(value);
    for(const op of operations){
      const add=(key,id)=>{if(!result[key].includes(id)&&result[key].length<limits[key])result[key].push(id);};
      if(op.type==='merge')for(const key of Object.keys(limits))for(const id of op[key])add(key,id);
      else if(op.type==='add')add(op.list,op.item);
      else result[op.list]=result[op.list].filter(id=>id!==op.item);
    }
    return result;
  }
  async function request(body){
    const response=await fetch('/api/auth/selections',{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    const value=await response.json();
    if(!response.ok)throw Object.assign(new Error(value.error||'Не вдалося синхронізувати вибір.'),{status:response.status});
    return value;
  }
  function finishGuestMerge(operations){
    const merged=operations.filter(op=>op.type==='merge');if(!merged.length)return;
    const guest=clean(read(guestKey));
    for(const key of Object.keys(limits))guest[key]=guest[key].filter(id=>!merged.some(op=>op[key].includes(id)));
    save(guestKey,guest);
  }
  async function runSync(){
    if(!user)return;
    const currentEpoch=epoch,owner=user.id;
    try{
      do{
        const batch=queue.slice(0,100),value=await request(batch.length?{owner,operations:batch}:null);
        if(currentEpoch!==epoch)return;
        if(value.owner!==owner)throw Object.assign(new Error('Акаунт змінився. Оновіть сторінку.'),{status:409});
        const sent=new Set(batch.map(op=>op.id));queue=queue.filter(op=>!sent.has(op.id));
        for(const key of pendingKeys(owner)){const saved=read(key);saveQueue(key,(Array.isArray(saved.queue)?saved.queue:[]).filter(op=>!sent.has(op.id)));}
        finishGuestMerge(batch);data=apply(value,queue);persist();
        message=value.overflow?.length?'Список заповнений: до 4 товарів у порівнянні та до 250 улюблених. Частину вибору не додано.':'Збережено в акаунті. Вибір синхронізується між пристроями.';publish();
      }while(queue.length&&currentEpoch===epoch);
    }catch(problem){
      if(currentEpoch!==epoch)return;
      message=[401,409].includes(problem.status)?'Увійдіть повторно або оновіть сторінку. Незбережені зміни залишилися для вашого акаунта.':'Синхронізація очікує з’єднання. Вибір збережено на цьому пристрої.';
      publish();
    }
  }
  function sync(){if(busy)return busy;busy=runSync().finally(()=>{busy=null;});return busy;}
  async function connect(next){
    if(next?.id===user?.id){publish();await sync();return;}
    epoch++;if(busy)await busy;user=next||null;
    if(!user){queue=[];data=clean(read(guestKey));message='Збережено на цьому пристрої. Увійдіть для синхронізації.';publish();return;}
    const cached=read(prefix+user.id),pending=pendingKeys(user.id).flatMap(key=>{const value=read(key).queue;return Array.isArray(value)?value:[];});
    queue=[...new Map(pending.filter(op=>op&&typeof op.id==='string').map(op=>[op.id,op])).values()];data=clean(cached);
    const guest=clean(read(guestKey));
    if(Object.values(guest).some(items=>items.length)&&!queue.some(op=>op.type==='merge'))queue.push({id:operationId(),type:'merge',...guest});
    data=apply(data,queue);message='Синхронізуємо вибір…';persist();publish();await sync();
  }
  function toggle(list,item){
    if(!Object.hasOwn(limits,list))return;
    const removing=data[list].includes(item);
    if(!removing&&data[list].length>=limits[list])return list==='comparison'?'Можна порівняти до 4 комплектацій. Приберіть одну, щоб додати іншу.':'Список улюблених заповнений.';
    const op={id:operationId(),type:removing?'remove':'add',list,item};
    data=apply(data,[op]);if(user)queue.push(op);persist();publish();
    if(user)void sync();
  }
  globalThis.VSMarketSelections={value:copy,toggle,connect,sync,subscribe(fn){listeners.add(fn);fn(copy());return ()=>listeners.delete(fn);}};
  globalThis.addEventListener('online',()=>void sync());
  globalThis.addEventListener('storage',event=>{
    if(!user&&event.key===guestKey){data=clean(read(guestKey));publish();}
    if(user&&event.key===prefix+user.id)void sync();
  });
  setInterval(()=>{if(user&&document.visibilityState!=='hidden')void sync();},30000);
  publish();
})();
