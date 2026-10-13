import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8790';
for(const route of ['/','/catalog','/account/login']){
 const html=await(await fetch(base+route)).text(),header=html.match(/<header[\s\S]*?<\/header>/)[0];
 const tools=header.match(/<div class="shopping-tools"[\s\S]*?<\/div>/)[0];
 assert.match(tools,/cart-trigger/);assert.match(tools,/id="cart-count"/);assert.doesNotMatch(tools,/brand-cart-icon/);
 assert.ok(header.indexOf('account-actions')>header.indexOf('cart-trigger'));
 assert.match(header,/<button[^>]*id="header-logout"[^>]*hidden/);
 assert.match(html,/account-session.js\?v=20261008-15/);
}
for(const file of ['home.js','app.js','account-session.js','assets/shopping-lists.css','assets/home.css']){
 const response=await fetch(base+'/'+file+'?v=20261008-15');assert.equal(response.status,200);
 assert.equal(await response.text(),await fs.readFile(new URL('../public/'+file,import.meta.url),'utf8'));
}
console.log('Verified current header markup on home, catalog and account; shared cart styling, rightmost account actions and current social icons script are served.');
