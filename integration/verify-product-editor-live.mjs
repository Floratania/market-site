import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const saved=JSON.parse(await fs.readFile(new URL('../.runtime/manage-activation-fixture.json',import.meta.url),'utf8'));
assert.ok(saved.externalReference.startsWith('vsmarket-activation-test:'));
const token=await localAdminToken();
const result=await localSaleor('query($id:ID!){product(id:$id){id externalReference variants{id sku}}}',{id:saved.id},token);
assert.equal(result.product.externalReference,saved.externalReference);const variant=result.product.variants.find(v=>v.sku===saved.sku);assert.ok(variant);
const base='http://127.0.0.1:8790',credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
async function request(route,body){const result=await fetch(base+'/api/manage/'+route,{headers:{Cookie:cookie,...(body?{Origin:base,'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});const data=await result.json();assert.equal(result.status,200,data.error);return data;}
const ids={productId:saved.id,variantId:variant.id};
try{
 let edited=await request('product?'+new URLSearchParams(ids));assert.equal(edited.sku,saved.sku);
 edited=await request('edit',{...ids,section:'model',name:'Тест редагування — тимчасова модель',description:'Тестовий опис. Два комплекти <для перевірки> & деталі.'});assert.equal(edited.name,'Тест редагування — тимчасова модель');assert.equal(edited.description,'Тестовий опис. Два комплекти <для перевірки> & деталі.');
 edited=await request('edit',{...ids,section:'specifications',specifications:{width:'850',height:'2000',color:'Графіт',opening:'L',type:'Двері технічні'}});assert.equal(edited.specifications.find(item=>item.key==='width').value,'850');assert.equal(edited.variantName,'850 × 2000 мм · Графіт · L');
 edited=await request('edit',{...ids,section:'price',mode:'manual',price:1234.56});assert.equal(edited.price,1234.56);assert.equal(edited.priceMode,'manual');
 await request('activation',{productId:saved.id,active:true});
 const published=(await(await fetch(base+'/api/catalog')).json()).products.find(p=>p.sku===saved.sku);assert.equal(published.name,edited.name);assert.equal(published.price,1234.56);assert.equal(published.specifications.find(s=>s.key==='color').value,'Графіт');assert.equal(published.description,edited.description);
 console.log('Live editor verified: native model text, exact SKU dimensions/color/opening/type, UAH price and public catalog all match');
}finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{}'});}
