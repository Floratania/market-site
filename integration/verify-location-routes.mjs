import assert from 'node:assert/strict';
const base='http://127.0.0.1:8790';
const site=await (await fetch(`${base}/api/site`)).json();
assert.equal(site.routing.mode,'driving');assert.equal(site.routing.metric,'distance');
const request=body=>fetch(`${base}/api/location-routes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await request({origin:{latitude:'48',longitude:25}})).status,400);
if(!site.routing.enabled){
 const response=await request({origin:{latitude:site.locations[0].latitude,longitude:site.locations[0].longitude}});
 assert.equal(response.status,503);assert.match((await response.json()).error,/недоступне/);
}
console.log(JSON.stringify({routingEnabled:site.routing.enabled,invalidCoordinatesRejected:true,provider:site.routing.provider}));
