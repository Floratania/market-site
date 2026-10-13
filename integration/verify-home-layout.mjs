import assert from 'node:assert/strict';
const base='http://127.0.0.1:8790';
const home=await fetch(base+'/');assert.equal(home.status,200);const html=await home.text();
for(const id of ['about','constructor','configurator-form','socials'])assert.ok(html.includes(`id="${id}"`),id);
assert.match(html,/<div id="home-page">/);assert.match(html,/id="catalog" aria-labelledby="catalog-title" hidden/);
const page=await fetch(base+'/catalog');assert.equal(page.status,200);const catalog=await page.text();assert.match(catalog,/<div id="home-page" hidden>/);assert.match(catalog,/id="catalog" aria-labelledby="catalog-title">/);
for(const path of ['/home.js?v=20261008-10','/app.js?v=20261008-10','/assets/home.css?v=20261008-10'])assert.equal((await fetch(base+path)).status,200,path);
const settings=await (await fetch(base+'/api/site')).json();assert.deepEqual(settings.socials.map(item=>item.label),['Facebook','Instagram','TikTok']);
const inventory=await (await fetch(base+'/api/catalog')).json();assert.ok(inventory.products?.length);console.log(JSON.stringify({verified:true,home:200,catalog:200,socials:settings.socials.length,products:inventory.products.length}));
