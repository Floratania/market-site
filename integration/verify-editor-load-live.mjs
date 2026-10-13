import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8790';
const credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});
if(!response.ok)throw new Error('Local login failed');
const cookie=response.headers.get('set-cookie').split(';')[0];
const request=async(route)=>{const result=await fetch(base+route,{headers:{Cookie:cookie}});assert.equal(result.status,200);return result.json();};
try{
 const {products}=await request('/api/manage/catalog');
 const read=product=>request('/api/manage/product?'+new URLSearchParams({productId:product.productId,variantId:product.id}));
 const sigara=products.find(p=>p.sku==='25-00000668'),data=await read(sigara);
 assert.equal(data.specifications.find(s=>s.key==='opening_direction').value,'R');assert.equal(data.description,'');assert.equal(data.sourceDescription,'');
 const source=JSON.parse(await fs.readFile(new URL('source-descriptions.local.json',import.meta.url),'utf8'));
 const candidate=products.find(p=>source.items.some(row=>row.sku===p.sku));
 const editor=await read(candidate);assert.equal(editor.sourceDescription,source.items.find(row=>row.sku===candidate.sku).description);
 assert.equal((await fetch(base+'/integration/source-descriptions.local.json')).status,404);
 console.log(JSON.stringify({opening:'R',selectedDescription:'empty in source and Saleor',sourcePreviewSku:candidate.sku,sourceDescriptionAvailable:true,privateFileBlocked:true}));
}finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:'{}'});}
