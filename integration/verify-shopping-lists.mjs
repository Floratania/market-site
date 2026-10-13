import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:8790';
for(const route of ['/','/account/login']){
 const response=await fetch(base+route);const html=await response.text();
 for(const token of ['shopping-tools','Улюблені','Порівняння','brand-logo-frame','/assets/brand-variants.css?v=20261008-7','/assets/shopping-lists.css?v=20261008-7'])if(!response.ok||!html.includes(token))throw new Error('Missing '+token+' at '+route);
 if(route==='/'&&!html.includes('/app.js?v=20261008-7'))throw new Error('Unversioned app');
}
for(const path of ['/app.js?v=20261008-7','/assets/shopping-lists.css?v=20261008-7','/assets/brand-variants.css?v=20261008-7']){
 const response=await fetch(base+path);if(!response.ok)throw new Error('Unavailable '+path);
 const served=Buffer.from(await response.arrayBuffer());
 const local=await readFile(new URL('../public'+path.split('?')[0],import.meta.url));
 const hash=data=>createHash('sha256').update(data).digest('hex');
 if(hash(served)!==hash(local))throw new Error('Stale asset '+path);
}
console.log('Verified live catalog and login list navigation, corrected logo frame, and exact current JS/CSS served by localhost.');
