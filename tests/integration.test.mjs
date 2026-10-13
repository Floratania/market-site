import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('catalogue and manager lead use server prices and verified pickup stock', async (t) => {
  const delivered = [];
  let inventoryUpdatedAt = new Date().toISOString();
  const source = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/graphql')) {
      res.end(JSON.stringify({ data: { products: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [{ node: {
        id: 'p1', name: 'Test product', slug: 'test-product', description: null, thumbnail: null,
        category: { id: 'c1', name: 'Category', slug: 'category' }, metadata: [],
        variants: [{ id: 'v1', name: 'Variant', sku: 'SKU-1', quantityAvailable: 5, pricing: { price: { gross: { amount: 150, currency: 'UAH' } } } }],
      } }] } } }));
    } else if (req.url.startsWith('/inventory')) {
      res.end(JSON.stringify({ items: [{ sku: 'SKU-1', location: 'mamaivtsi', quantity: 2, updatedAt: inventoryUpdatedAt }] }));
    } else if (req.url === '/manager') {
      delivered.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      res.end('{}');
    } else { res.statusCode = 404; res.end('{}'); }
  });
  source.listen(0, '127.0.0.1'); await once(source, 'listening');
  const sourceUrl = `http://127.0.0.1:${source.address().port}`;
  const serverPort = 18790;
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(serverPort), SALEOR_GRAPHQL_URL: `${sourceUrl}/graphql`, INVENTORY_API_URL: `${sourceUrl}/inventory`, MANAGER_WEBHOOK_URL: `${sourceUrl}/manager` }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); source.close(); });
  const base = `http://127.0.0.1:${serverPort}`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { const response = await fetch(base); if (response.ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, 'local server starts');
  const homeHtml=await (await fetch(base)).text();assert.match(homeHtml,/id="home-page">/);assert.match(homeHtml,/id="catalog" aria-labelledby="catalog-title" hidden/);assert.match(homeHtml,/id="configurator-form"/);
  const catalogPage=await fetch(`${base}/catalog`);assert.equal(catalogPage.status,200);const catalogHtml=await catalogPage.text();assert.match(catalogHtml,/id="home-page" hidden/);assert.match(catalogHtml,/id="catalog" aria-labelledby="catalog-title">/);
  assert.equal((await fetch(`${base}/home.js`)).status,200);assert.equal((await (await fetch(`${base}/api/site`)).json()).socials.length,3);
  for (const asset of ['/brand.css', '/logo.png', '/brand-icon.svg']) {
    assert.equal((await fetch(`${base}${asset}`)).status, 200, `${asset} is served`);
  }
  const catalog = await (await fetch(`${base}/api/catalog`)).json();
  assert.equal(catalog.products[0].price, 150);
  assert.equal(catalog.stockVerified, true);
  for (const path of ['/products/test-product','/products/test-product?variant=v1','/products/demo-window-1?demo=1']) {
    const response=await fetch(`${base}${path}`);
    assert.equal(response.status,200,'direct product URL works without opening the home page first');
    assert.match(response.headers.get('Content-Type'),/text\/html/);
    assert.match(await response.text(),/<section id="product-page"/);
  }
  assert.equal((await fetch(`${base}/products/missing`)).status,404);
  assert.equal((await fetch(`${base}/products/test-product?variant=missing`)).status,404);
  assert.equal((await fetch(`${base}/products/missing?demo=1`)).status,404);
  assert.match(await (await fetch(`${base}/products/test-product`)).text(),/<title>Test product — VS Market<\/title>/);
  const lead = { name: 'Test customer', phone: '+380501234567', delivery: 'pickup', location: 'mamaivtsi', comment: '', lines: [{ sku: 'SKU-1', quantity: 3, price: 1 }] };
  const denied = await fetch(`${base}/api/lead`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
  assert.equal(denied.status, 409);
  assert.equal(delivered.length, 0, 'insufficient stock never reaches manager');
  lead.lines[0].quantity = 2;
  const accepted = await fetch(`${base}/api/lead`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
  assert.equal(accepted.status, 201);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].lines[0].unitPrice, 150, 'client price is ignored');
  assert.equal(delivered[0].location, 'mamaivtsi');
  inventoryUpdatedAt = new Date(Date.now() - 300_000).toISOString();
  const stale = await fetch(`${base}/api/lead`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
  assert.equal(stale.status, 503, 'stale pickup stock cannot be accepted');
  assert.equal(delivered.length, 1, 'stale stock never reaches manager');
  const customDesign={kind:'window',width:1200,height:1400,color:'white',material:'pvc',opening:'tilt-turn',sections:2};
  const customLead={...lead,delivery:'manager',location:null,lines:[{customDesign:{...customDesign,price:1,name:'Untrusted name'},quantity:1,price:1}]};
  const customResponse=await fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(customLead)});assert.equal(customResponse.status,201);
  assert.equal(delivered[1].lines[0].unitPrice,null);assert.equal(delivered[1].lines[0].sku,null);assert.deepEqual(delivered[1].lines[0].customDesign,customDesign);assert.match(delivered[1].lines[0].name,/Вікно за індивідуальними/);
  const invalid=await fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...customLead,lines:[{customDesign:{...customDesign,width:-5},quantity:1}]})});assert.equal(invalid.status,400);assert.equal(delivered.length,2);
  const customPickup=await fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...customLead,delivery:'pickup',location:'mamaivtsi'})});assert.equal(customPickup.status,409);assert.equal(delivered.length,2);
});
