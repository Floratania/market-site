import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {rankRouteLocations,rankDistanceLocations,routeUrl,initLocations} from '../public/locations.js';
import {publicLocations} from '../integration/site-locations.mjs';
import {drivingRoutes} from '../integration/location-routes.mjs';
const content=JSON.parse(await fs.readFile(new URL('../integration/site-content.json',import.meta.url),'utf8'));
const locations=publicLocations(content);
const routes=[{id:locations[0].id,reachable:true,distanceMeters:20000,durationSeconds:1200},{id:locations[1].id,reachable:true,distanceMeters:13000,durationSeconds:1500}];
function fixture(geolocation,fetchRoutes=async()=>({routes,mode:'driving',metric:'distance',provider:'OSRM'})){
 const elements=new Map();
 for(const key of ['list','map','status','caption','privacy'])elements.set(`[data-location-${key}]`,{textContent:'',innerHTML:'',hidden:true,src:'',getAttribute(name){return this[name]||null;},handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}});
 elements.set('[data-map-caption]',elements.get('[data-location-caption]'));
 const button={disabled:true,innerHTML:'',handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}};
 elements.set('[data-locate]',button);
 return {root:{querySelector:key=>elements.get(key)},elements,button,options:{fetchSite:async()=>({locations,routing:{enabled:true,provider:'OSRM'}}),fetchRoutes,geolocation}};
}
test('ranks by road distance, not location proximity or fastest duration; validates complete comparison',()=>{
 assert.equal(rankRouteLocations(locations,routes)[0].id,locations[1].id);
 assert.throws(()=>rankRouteLocations(locations,routes.slice(0,1)));
 assert.throws(()=>rankRouteLocations(locations,[routes[0],routes[0]]));
 assert.throws(()=>rankRouteLocations(locations,[routes[0],{...routes[1],distanceMeters:NaN}]));
 const unreachable={...routes[1],reachable:false,distanceMeters:null,durationSeconds:null};
 assert.equal(rankRouteLocations(locations,[routes[0],unreachable])[0].id,locations[0].id);
 for(const location of locations){const url=new URL(routeUrl(location));assert.equal(url.searchParams.get('travelmode'),'driving');assert.equal(url.searchParams.get('origin'),null);}
 assert.deepEqual(publicLocations({locations:[{...locations[0],embedUrl:'https://attacker.example/map'}]}),[]);
});
test('straight-line distances validate coordinates and match known great-circle distance',()=>{
 const result=rankDistanceLocations([{id:'east',latitude:0,longitude:1},{id:'here',latitude:0,longitude:0}],{latitude:0,longitude:0});
 assert.equal(result[0].id,'here');assert.equal(result[0].distanceMeters,0);
 assert.ok(Math.abs(result[1].distanceMeters-111195)<1);
 assert.throws(()=>rankDistanceLocations(locations,{latitude:91,longitude:0}));
 assert.throws(()=>rankDistanceLocations(locations,{latitude:NaN,longitude:0}));
});
test('asks only on click and calculates nearest without routing even when API is disabled',async()=>{
 let calls=0,routeCalls=0;
 const f=fixture({getCurrentPosition(success){calls++;success({coords:{...locations[0],accuracy:25}});}},async()=>{routeCalls++;throw new Error('Must not call');});
 f.options.fetchSite=async()=>({locations,routing:{enabled:false}});
 await initLocations(f.root,f.options);assert.equal(calls,0);
 await f.button.handlers.click();assert.equal(calls,1);assert.equal(routeCalls,0);
 assert.equal(f.elements.get('[data-location-map]').src,locations[0].embedUrl);
 assert.match(f.elements.get('[data-location-list]').innerHTML,/по прямій/);
 assert.match(f.elements.get('[data-location-status]').textContent,/Мамаївці/);
 assert.equal(f.button.disabled,false);
 f.elements.get('[data-location-list]').handlers.click({target:{closest:()=>({dataset:{location:'buda'}})}});
 assert.equal(f.elements.get('[data-location-map]').src,locations[1].embedUrl);
 assert.match(f.elements.get('[data-location-list]').innerHTML,/Найближча точка/);
});
test('denial and invalid coordinates preserve manual selection without fake nearest',async()=>{
 for(const code of [1,2,3]){
  const f=fixture({getCurrentPosition(success,error){error({code});}});await initLocations(f.root,f.options);await f.button.handlers.click();
  assert.equal(f.button.disabled,false);assert.match(f.elements.get('[data-location-status]').textContent,/вручну/);
  assert.doesNotMatch(f.elements.get('[data-location-list]').innerHTML,/Найближча точка/);
 }
 const f=fixture({getCurrentPosition(success){success({coords:{latitude:NaN,longitude:0}});}});
 await initLocations(f.root,f.options);await f.button.handlers.click();
 assert.match(f.elements.get('[data-location-status]').textContent,/Не вдалося розрахувати/);
 assert.doesNotMatch(f.elements.get('[data-location-list]').innerHTML,/Найближча точка|по прямій/);
});
test('coarse GPS displays uncertainty',async()=>{
 const f=fixture({getCurrentPosition(success){success({coords:{...locations[0],accuracy:20000}});}});
 await initLocations(f.root,f.options);await f.button.handlers.click();
 assert.match(f.elements.get('[data-location-list]').innerHTML,/Орієнтовно найближча/);
 assert.match(f.elements.get('[data-location-status]').textContent,/приблизно/);
});
test('Google route matrix uses server key and destination indices, rejecting provider errors',async()=>{
 let sent;
 const fetchImpl=async(url,options)=>{sent={url,options};return {ok:true,json:async()=>[{destinationIndex:1,condition:'ROUTE_EXISTS',status:{},distanceMeters:13000,duration:'1500s'},{condition:'ROUTE_EXISTS',status:{},distanceMeters:20000,duration:'1200s'}]};};
 const result=await drivingRoutes(locations[0],locations,{provider:'google',googleApiKey:'test-only-key'},{fetchImpl});
 assert.equal(sent.options.headers['X-Goog-Api-Key'],'test-only-key');
 assert.equal(JSON.parse(sent.options.body).travelMode,'DRIVE');assert.equal(result.routes[0].id,'buda');
 await assert.rejects(drivingRoutes(locations[0],locations,{provider:'google',googleApiKey:'test-only-key'},{fetchImpl:async()=>({ok:true,json:async()=>[{condition:'ROUTE_EXISTS',status:{code:13}},{destinationIndex:1,condition:'ROUTE_EXISTS'}]})}));
 await assert.rejects(drivingRoutes({latitude:'48',longitude:25},locations,{provider:'google',googleApiKey:'test-only-key'},{fetchImpl}));
});
test('OSRM requests a driving matrix without straight-line fallback and blocks commercial use of public demo',async()=>{
 let requestUrl;
 const fetchImpl=async url=>{requestUrl=new URL(url);return {ok:true,json:async()=>({code:'Ok',distances:[[20000,13000]],durations:[[1200,1500]]})};};
 const config={provider:'osrm',osrmBaseUrl:'http://127.0.0.1:5000'};
 const result=await drivingRoutes(locations[0],locations,config,{fetchImpl});
 assert.equal(result.routes[1].distanceMeters,13000);assert.equal(requestUrl.searchParams.get('annotations'),'distance,duration');assert.equal(requestUrl.searchParams.get('fallback_speed'),null);
 await assert.rejects(drivingRoutes(locations[0],locations,{...config,osrmBaseUrl:'https://router.project-osrm.org'},{fetchImpl}));
 await assert.rejects(drivingRoutes(locations[0],locations,config,{fetchImpl:async()=>({ok:true,json:async()=>({code:'Ok',distances:[[20000]],durations:[[1200]]})})}));
});
