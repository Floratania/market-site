import fs from 'node:fs/promises';
const configFile=new URL('routing.local.json',import.meta.url);
const routingError=(message='Не вдалося порівняти автомобільні маршрути',status=503)=>Object.assign(new Error(message),{status});
export async function routingConfig(){
 let config={};try{config=JSON.parse(await fs.readFile(configFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw routingError();}
 return {...config,googleApiKey:process.env.GOOGLE_ROUTES_API_KEY||config.googleApiKey||'',osrmBaseUrl:process.env.OSRM_BASE_URL||config.osrmBaseUrl||''};
}
export function routingInfo(config){
 const enabled=config.provider==='google'?Boolean(config.googleApiKey):config.provider==='osrm'?Boolean(config.osrmBaseUrl):false;
 return {enabled,provider:config.provider==='google'?'Google Maps':'OSRM',mode:'driving',metric:'distance'};
}
export function validateOrigin(origin){
 if(typeof origin?.latitude!=='number'||!Number.isFinite(origin.latitude)||Math.abs(origin.latitude)>90||typeof origin.longitude!=='number'||!Number.isFinite(origin.longitude)||Math.abs(origin.longitude)>180)throw routingError('Некоректні координати',400);
 return {latitude:origin.latitude,longitude:origin.longitude};
}
export async function drivingRoutes(origin,locations,config,{fetchImpl=fetch}={}){
 origin=validateOrigin(origin);
 if(!routingInfo(config).enabled)throw routingError('Розрахунок автомобільних маршрутів ще не підключено');
 if(!locations.length||locations.length>20)throw routingError();
 const signal=AbortSignal.timeout(10000);
 let routes;
 try{
  if(config.provider==='google'){
   const response=await fetchImpl('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':config.googleApiKey,'X-Goog-FieldMask':'originIndex,destinationIndex,status,condition,distanceMeters,duration'},body:JSON.stringify({origins:[{waypoint:{location:{latLng:origin}}}],destinations:locations.map(p=>({waypoint:{placeId:p.placeId}})),travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',languageCode:'uk'})});
   if(!response.ok)throw routingError();
   const rows=await response.json();
   if(!Array.isArray(rows)||rows.length!==locations.length)throw routingError();
   const seen=new Set();
   routes=rows.map(row=>{
    const index=row.destinationIndex??0;
    if((row.originIndex??0)!==0||!Number.isInteger(index)||!locations[index]||seen.has(index))throw routingError();
    seen.add(index);
    if(row.condition==='ROUTE_NOT_FOUND')return {id:locations[index].id,distanceMeters:null,durationSeconds:null,reachable:false};
    const distance=row.distanceMeters??0,duration=Number(String(row.duration??'0s').replace(/s$/,''));
    if(row.status?.code||row.condition!=='ROUTE_EXISTS'||!Number.isFinite(distance)||distance<0||!/^\d+(\.\d+)?s$/.test(row.duration??'0s')||!Number.isFinite(duration))throw routingError();
    return {id:locations[index].id,distanceMeters:distance,durationSeconds:duration,reachable:true};
   });
  }else{
   const base=new URL(config.osrmBaseUrl);
   if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw routingError();
   // The public OSRM demo prohibits commercial use. Configure your own instance.
   if(['router.project-osrm.org','routing.openstreetmap.de'].includes(base.hostname))throw routingError('Для магазину потрібен власний сервер маршрутів OSRM');
   const coords=[origin,...locations].map(p=>`${p.longitude},${p.latitude}`).join(';');
   const url=new URL(`${base.pathname.replace(/\/$/,'')}/table/v1/driving/${coords}`,base.origin);
   url.search=new URLSearchParams({sources:'0',destinations:locations.map((_,i)=>i+1).join(';'),annotations:'distance,duration',radiuses:Array(locations.length+1).fill('500').join(';')});
   const response=await fetchImpl(url,{signal,redirect:'error'});
   if(!response.ok)throw routingError();
   const data=await response.json(),distances=data.distances?.[0],durations=data.durations?.[0];
   if(data.code!=='Ok'||!Array.isArray(distances)||!Array.isArray(durations)||distances.length!==locations.length||durations.length!==locations.length||data.fallback_speed_cells?.length)throw routingError();
   routes=locations.map((p,i)=>{
    const distance=distances[i],duration=durations[i];
    if(distance===null&&duration===null)return {id:p.id,distanceMeters:null,durationSeconds:null,reachable:false};
    if(!Number.isFinite(distance)||distance<0||!Number.isFinite(duration)||duration<0)throw routingError();
    return {id:p.id,distanceMeters:distance,durationSeconds:duration,reachable:true};
   });
  }
 }catch(error){throw routingError(error.status?error.message:undefined);}
 return {routes,provider:routingInfo(config).provider,mode:'driving',metric:'distance'};
}
