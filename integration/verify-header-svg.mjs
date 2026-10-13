import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8790';
for(const file of ['brand-logo.svg','brand-cart.svg']){
 const response=await fetch(base+'/assets/icons/'+file);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith('image/svg+xml'));
 const served=Buffer.from(await response.arrayBuffer()),local=await readFile(new URL('../public/assets/icons/'+file,import.meta.url));
 assert.equal(createHash('sha256').update(served).digest('hex'),createHash('sha256').update(local).digest('hex'));
 if(file==='brand-cart.svg')assert.match(served.toString(),/viewBox="0 0 130 109"/);
}
for(const route of ['/','/catalog','/account/login']){
 const response=await fetch(base+route);assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/class="brand-logo" src="\/assets\/icons\/brand-logo.svg"/);assert.match(html,/class="brand-mobile-cart"/);assert.match(html,/\/assets\/brand-variants.css\?v=20261008-11/);
 const header=html.split('<header')[1].split('</header>')[0];assert.doesNotMatch(header,/brand-compact.png|src="\/logo.png"/);
}
console.log('Verified SVG assets and header references on home, catalog and login; mobile cart crop is 130 × 109.');
