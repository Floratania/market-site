import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const publicDir=new URL('../public/',import.meta.url);
const originals=[['S_F_Red.png','brand-compact.png'],['vs mark 4 (3).png','brand-cart-light.png'],['vs mark 5 (4).png','brand-cart-dark.png']];
const manifest=[];
for(const [source,target] of originals){
  const original='C:/Users/tetiana.flora/Downloads/'+source;
  const data=await readFile(original);
  if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Expected PNG: '+source);
  await copyFile(original,new URL('assets/'+target,publicDir));
  manifest.push({source,file:target,width:data.readUInt32BE(16),height:data.readUInt32BE(20),sha256:createHash('sha256').update(data).digest('hex')});
}
await writeFile(new URL('assets/brand-originals.json',publicDir),JSON.stringify(manifest,null,2)+'\n');
const compact='<span class="brand-compact" aria-hidden="true"><img src="/assets/brand-compact.png" alt="" width="1246" height="701"></span>';
for(const name of ['index.html','account.html']){
  const file=new URL(name,publicDir);
  let html=await readFile(file,'utf8');
  html=html.replace('<link rel="icon" type="image/svg+xml" href="/brand-icon.svg">','<link id="brand-favicon" rel="icon" type="image/png" href="/assets/brand-cart-dark.png">');
  if(!html.includes('/assets/brand-variants.css'))html=html.replace('<link rel="stylesheet" href="/account.css">','<link rel="stylesheet" href="/account.css">\n  <link rel="stylesheet" href="/assets/brand-variants.css?v=20261008-4">');
  html=html.replace('<img class="brand-logo" src="/logo.png" alt="VS Market"></a>','<img class="brand-logo" src="/logo.png" alt="VS Market">'+compact+'</a>');
  html=html.replace('<a class="footer-brand" href="/" aria-label="VS Market"><img src="/logo.png" alt="VS Market"></a>','<a class="footer-brand" href="/" aria-label="VS Market">'+compact+'</a>');
  html=html.replace('<img class="ui-icon" src="/assets/icons/shopping-cart.svg" alt=""><span>Кошик</span>','<span class="brand-cart-icon" aria-hidden="true"><img class="brand-on-light" src="/assets/brand-cart-light.png" alt=""><img class="brand-on-dark" src="/assets/brand-cart-dark.png" alt=""></span><span>Кошик</span>');
  html=html.replace('/app.js?v=20261008-3','/app.js?v=20261008-4').replace('src="/account-session.js"','src="/account-session.js?v=20261008-4"');
  await writeFile(file,html);
}
console.log('Official logo originals copied unchanged:',JSON.stringify(manifest));
