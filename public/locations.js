export function rankRouteLocations(locations,routes){
 if(!Array.isArray(routes)||routes.length!==locations.length||new Set(routes.map(r=>r.id)).size!==locations.length)throw new Error('Incomplete routes');
 return locations.map(location=>{
  const route=routes.find(r=>r.id===location.id);
  if(!route||typeof route.reachable!=='boolean'||(route.reachable&&(!Number.isFinite(route.distanceMeters)||route.distanceMeters<0||!Number.isFinite(route.durationSeconds)||route.durationSeconds<0)))throw new Error('Invalid route');
  return {...location,...route};
 }).sort((a,b)=>Number(b.reachable)-Number(a.reachable)||(a.distanceMeters??Infinity)-(b.distanceMeters??Infinity)||(a.durationSeconds??Infinity)-(b.durationSeconds??Infinity));
}
export function rankDistanceLocations(locations,origin){
 const valid=p=>Number.isFinite(p?.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p?.longitude)&&Math.abs(p.longitude)<=180;
 if(!valid(origin)||!locations.every(valid))throw new Error('Invalid coordinates');
 const radians=n=>n*Math.PI/180;
 return locations.map(location=>{
  const a=Math.sin(radians(location.latitude-origin.latitude)/2)**2+Math.cos(radians(origin.latitude))*Math.cos(radians(location.latitude))*Math.sin(radians(location.longitude-origin.longitude)/2)**2;
  return {...location,distanceMeters:6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))))};
 }).sort((a,b)=>a.distanceMeters-b.distanceMeters);
}
export function geolocationMessage(error){
 return ({1:'Доступ до геолокації заборонено. Дозвольте його в налаштуваннях браузера або оберіть точку вручну.',2:'Не вдалося визначити місцезнаходження. Оберіть точку вручну або спробуйте ще раз.',3:'Визначення місцезнаходження зайняло надто багато часу. Спробуйте ще раз або оберіть точку вручну.'})[error?.code]||'Геолокація недоступна. Оберіть точку вручну.';
}
export function routeUrl(location){
 const url=new URL('https://www.google.com/maps/dir/');
 url.search=new URLSearchParams({api:'1',destination:`${location.latitude},${location.longitude}`,destination_place_id:location.placeId,travelmode:'driving'});
 return url.href;
}
const pin='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
const locate='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></svg>';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const distanceLabel=meters=>meters<100?'менше 100 м':`${new Intl.NumberFormat('uk',{maximumFractionDigits:1}).format(meters/1000)} км`;
export async function initLocations(root,{fetchSite=()=>fetch('/api/site').then(response=>{if(!response.ok)throw new Error('Site unavailable');return response.json();}),geolocation=globalThis.navigator?.geolocation}={}){
 if(!root)return;
 const list=root.querySelector('[data-location-list]'),map=root.querySelector('[data-location-map]'),status=root.querySelector('[data-location-status]'),button=root.querySelector('[data-locate]'),caption=root.querySelector('[data-map-caption]'),privacy=root.querySelector('[data-location-privacy]');
 let locations=[],ordered=[],selected='',nearest='',uncertain=false;
 const setStatus=text=>{status.textContent=text;};
 const render=()=>{
  list.innerHTML=ordered.map(location=>`<article class="location-card${location.id===selected?' is-selected':''}"><button class="location-select" type="button" data-location="${escape(location.id)}" aria-pressed="${location.id===selected}">${pin}<span><strong>${escape(location.name)}</strong><span class="location-address">${escape(location.address)}</span></span><span class="location-marker" aria-hidden="true">↗</span></button>${location.id===nearest?`<span class="location-nearest">${uncertain?'Орієнтовно найближча':'Найближча точка'}</span>`:''}${Number.isFinite(location.distanceMeters)?`<p class="location-distance">${distanceLabel(location.distanceMeters)} по прямій</p>`:''}<div class="location-actions"><a href="${escape(routeUrl(location))}" target="_blank" rel="noopener noreferrer">Маршрут <span aria-hidden="true">↗</span></a>${location.phone?`<a href="tel:${escape(location.phone)}">${escape(location.phone.replace(/^(\+380)(\d{2})(\d{3})(\d{2})(\d{2})$/,'$1 $2 $3 $4 $5'))}</a>`:''}</div></article>`).join('');
 };
 const select=id=>{
  const location=locations.find(item=>item.id===id);if(!location)return;
  selected=id;map.title=`VS Market — ${location.name} на карті`;
  if(map.getAttribute('src')!==location.embedUrl)map.src=location.embedUrl;
  map.hidden=false;caption.textContent=`VS Market · ${location.name}`;render();
 };
 list.addEventListener('click',event=>{const choice=event.target.closest('[data-location]');if(choice)select(choice.dataset.location);});
 try{
  const site=await fetchSite();locations=site.locations||[];
  if(!locations.length)throw new Error('No locations');ordered=locations;select(locations[0].id);
  button.disabled=false;button.innerHTML=`${locate}<span>Знайти найближчу</span>`;
  setStatus('Визначимо найближчу точку за відстанню по прямій у кілометрах.');
  if(privacy)privacy.textContent='Відстань розраховуємо у вашому браузері. Координати для цього розрахунку не передаємо на сервер і не зберігаємо. Можна обрати точку вручну.';
 }catch{setStatus('Не вдалося завантажити точки. Відкрийте їх у Google Maps або оновіть сторінку.');return;}
 button.addEventListener('click',async()=>{
  if(!geolocation){setStatus(geolocationMessage());return;}
  button.disabled=true;ordered=locations;nearest='';render();
  setStatus('Визначаємо місцезнаходження. Якщо браузер запитає, дозвольте геолокацію.');
  let position;
  try{position=await new Promise((resolve,reject)=>geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000}));}
  catch(error){setStatus(geolocationMessage(error));button.disabled=false;return;}
  try{
   ordered=rankDistanceLocations(locations,position.coords);nearest=ordered[0]?.id||'';
   uncertain=!Number.isFinite(position.coords.accuracy)||position.coords.accuracy>250;
   if(nearest){select(nearest);const first=ordered[0];setStatus(`${uncertain?'Місцезнаходження визначено приблизно. ':''}Найближча точка — ${first.name}: ${distanceLabel(first.distanceMeters)} по прямій. Відстань дорогою може бути більшою.`);}

  }catch(error){ordered=locations;nearest='';render();setStatus('Не вдалося розрахувати відстань. Оберіть точку вручну або спробуйте ще раз.');}
  finally{button.disabled=false;}
 });
}
if(typeof document!=='undefined')initLocations(document.querySelector('[data-locations]'));
