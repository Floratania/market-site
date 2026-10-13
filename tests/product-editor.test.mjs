import test from 'node:test';
import assert from 'node:assert/strict';
import {getProductEditor,editProduct,manualPrice,manualPriceKey} from '../integration/product-editor.mjs';
import {productDescription} from '../integration/product-description.mjs';
test('promotion changes canonical Saleor price, returns to source price; photo override persists exact variant',async()=>{
 const f=fixture();const promotion=await editProduct(f.graphql,'shop',{...f.body,section:'promotion',enabled:true,price:80,label:'Акція'},f.source);assert.equal(promotion.price,80);assert.equal(promotion.promotion.originalPrice,100);
 await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'promotion',enabled:true,price:120},f.source),{status:400});
 const restored=await editProduct(f.graphql,'shop',{...f.body,section:'promotion',enabled:false},f.source);assert.equal(restored.promotion,null);assert.equal(restored.priceMode,'source');
 const photos=await editProduct(f.graphql,'shop',{...f.body,section:'photos',photos:['https://example.com/a.jpg','https://example.com/b.jpg']});assert.equal(photos.photos.length,2);
 await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'photos',photos:['javascript:alert(1)']}),{status:400});
});
function fixture(){
 const product={id:'p1',name:'Модель',description:null,metadata:[{key:'public_specs',value:JSON.stringify([{key:'width',label:'Ширина',value:'960',unit:'мм'},{key:'construction_type',label:'Тип конструкції',value:'Двері стандарт'}])}],privateMetadata:[{key:'integration',value:'keep'}],channelListings:[{channel:{id:'c1',slug:'shop'}},{channel:{id:'c2',slug:'other'}}],variants:[{id:'v1',name:'Комплектація',sku:'SKU-1',metadata:[{key:'original',value:'keep'},{key:'public_specs',value:JSON.stringify([{key:'color',label:'Колір',value:'Білий'}])}],privateMetadata:[{key:'original',value:'keep'}],channelListings:[{channel:{id:'c1',slug:'shop'},price:{amount:100,currency:'UAH'}}]}]};
 const calls=[];let failPriceMode=false;
 const graphql=async(query,variables)=>{
  calls.push({query,variables});const variant=product.variants[0];
  if(query.includes('ManageProductEditor'))return {product};
  if(query.includes('ManagePhotos')||query.includes('ManagePromotion')){variant.metadata=variant.metadata.filter(m=>!variables.input.some(i=>i.key===m.key)).concat(variables.input);return {updateMetadata:{errors:[]}};}
  if(query.includes('RecommendationCandidate'))return {productVariant:variables.sku==='OTHER'?{id:'v2',pricing:{price:{gross:{amount:200}}},product:{channelListings:[{channel:{slug:'shop'},isPublished:true}]}}:null};
  if(query.includes('ManageRecommendations')){variant.metadata=variant.metadata.filter(m=>m.key!=='storefront_recommendations').concat(variables.input);return {updateMetadata:{errors:[]}};}
  if(query.includes('ManageProductText')){Object.assign(product,variables.input);return {productUpdate:{errors:[]}};}
  if(query.includes('ManageProductSpecifications')){Object.assign(variant,variables.input);return {productVariantUpdate:{errors:[]}};}
  if(query.includes('ManageProductPriceMode')){if(failPriceMode)return {updatePrivateMetadata:{errors:[{code:'INVALID'}]}};const input=variables.input[0];variant.privateMetadata=variant.privateMetadata.filter(m=>m.key!==input.key).concat(input);return {updatePrivateMetadata:{errors:[]}};}
  if(query.includes('ManageProductPrice')){assert.equal(variables.id,'v1');assert.equal(variables.input.length,1);assert.equal(variables.input[0].channelId,'c1');variant.channelListings[0].price.amount=variables.input[0].price;return {productVariantChannelListingUpdate:{errors:[]}};}
  throw new Error('Unexpected query');
 };
 return {graphql,product,calls,source:async()=>125,body:{productId:'p1',variantId:'v1'},fail:()=>failPriceMode=true};
}
test('editor saves model text, exact SKU specifications, manual price and restores source pricing',async()=>{
 const f=fixture();let data=await getProductEditor(f.graphql,'shop',f.body,f.source);assert.equal(data.sourcePrice,125);assert.equal(data.priceMode,'source');
 data=await editProduct(f.graphql,'shop',{...f.body,section:'model',name:'Нова модель',description:'Текст <img onerror=evil> & пояснення'},f.source);
 assert.equal(data.name,'Нова модель');assert.equal(data.description,'Текст <img onerror=evil> & пояснення');assert.equal(f.product.privateMetadata.find(m=>m.key==='integration').value,'keep');
 data=await editProduct(f.graphql,'shop',{...f.body,section:'specifications',specifications:{width:'850',height:'2000',color:'Графіт',opening:'L',type:'Двері технічні'}},f.source);
 assert.equal(data.specifications.find(s=>s.key==='width').value,'850');assert.equal(data.specifications.find(s=>s.key==='width').unit,'мм');assert.equal(data.specifications.find(s=>s.key==='construction_type').value,'Двері технічні');assert.equal(data.variantName,'850 × 2000 мм · Графіт · L');
 assert.equal(f.product.variants[0].metadata.find(m=>m.key==='original').value,'keep');assert.equal(f.product.variants[0].sku,'SKU-1');
 data=await editProduct(f.graphql,'shop',{...f.body,section:'price',mode:'manual',price:150.25,channelId:'c2'},f.source);assert.equal(data.price,150.25);assert.equal(data.priceMode,'manual');assert.equal(manualPrice(f.product.variants[0].privateMetadata,'shop'),150.25);
 data=await editProduct(f.graphql,'shop',{...f.body,section:'price',mode:'source',price:1},f.source);assert.equal(data.price,125);assert.equal(data.priceMode,'source');
 assert.equal(productDescription(f.product.description),'Текст <img onerror=evil> & пояснення');
});
test('editor rejects wrong variants, invalid prices and dimensions; blank parameters override inherited values',async()=>{
 const f=fixture();
 await assert.rejects(getProductEditor(f.graphql,'shop',{...f.body,variantId:'other'}),{status:404});
 for(const price of [-1,0,1.234,Infinity,'100'])await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'price',mode:'manual',price},f.source),{status:400});
 await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'price',mode:'source'},async()=>null),{status:400});
 await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'specifications',specifications:{width:'850.5',height:'2000',color:'',opening:'',type:''}}),{status:400});
 const edited=await editProduct(f.graphql,'shop',{...f.body,section:'specifications',specifications:{width:'',height:'',color:'',opening:'',type:''}});assert.ok(!edited.specifications.some(s=>['width','color','construction_type'].includes(s.key)));
 const original=f.calls.filter(call=>!call.query.includes('ManageProductEditor'));assert.equal(original.length,1,'invalid edits do not issue writes');
 assert.equal(manualPrice([{key:manualPriceKey('shop'),value:'not-a-price'}],'shop'),null);
});
test('failed price-mode persistence rolls the price back',async()=>{
 const f=fixture();f.fail();await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'price',mode:'manual',price:200},f.source),{status:409});assert.equal(f.product.variants[0].channelListings[0].price.amount,100);
});
test('editor loads the existing description and separates opening side from opening kind',async()=>{
 const f=fixture();f.product.description=JSON.stringify({blocks:[{type:'paragraph',data:{text:'Наявний опис моделі'}}]});
 f.product.variants[0].metadata.push({key:'opening_direction',value:'R'},{key:'opening',value:'Поворотно-відкидне'});
 let data=await getProductEditor(f.graphql,'shop',f.body,f.source,async()=> 'Текст із бази обліку');
 assert.equal(data.description,'Наявний опис моделі');assert.equal(data.sourceDescription,'Текст із бази обліку');
 assert.equal(data.specifications.find(s=>s.key==='opening_direction').value,'R');assert.equal(data.specifications.find(s=>s.key==='opening').value,'Поворотно-відкидне');
 data=await editProduct(f.graphql,'shop',{...f.body,section:'specifications',specifications:{width:'850',height:'2000',color:'Білий',opening_direction:'L',opening:'Поворотне',type:'Вікно'}},f.source);
 assert.equal(data.specifications.find(s=>s.key==='opening_direction').value,'L');assert.equal(data.specifications.find(s=>s.key==='opening').value,'Поворотне');assert.equal(data.description,'Наявний опис моделі');
 await assert.rejects(editProduct(f.graphql,'shop',{...f.body,section:'specifications',specifications:{width:'',height:'',color:'',opening_direction:'wrong',opening:'',type:''}}),{status:400});
});
test('legacy side edits are read as R/L without losing source opening kind on unrelated saves',async()=>{
 const f=fixture();f.product.variants[0].metadata.push({key:'opening_direction',value:'R'});
 f.product.variants[0].metadata.push({key:'storefront_specs',value:JSON.stringify([{key:'opening',label:'Відкривання',value:'L'}])});
 const data=await getProductEditor(f.graphql,'shop',f.body);
 assert.equal(data.specifications.find(s=>s.key==='opening_direction').value,'L');assert.ok(!data.specifications.some(s=>s.key==='opening'));
});
test('source description is available only for staff review and is not published on read',async()=>{
 const f=fixture(),data=await getProductEditor(f.graphql,'shop',f.body,f.source,async sku=>{assert.equal(sku,'SKU-1');return 'Вихідний текст';});
 assert.equal(data.description,'');assert.equal(data.sourceDescription,'Вихідний текст');assert.equal(f.product.description,null);assert.equal(f.calls.length,1);
});
test('recommendation editor persists confirmed SKU links and rejects incompatible inputs',async()=>{
 const f=fixture(),body={...f.body,section:'recommendations',recommendations:{cross:[{sku:'OTHER',reason:'Перевірене кріплення'}],upsell:[]}};
 await assert.rejects(editProduct(f.graphql,'shop',body),{status:400});
 const saved=await editProduct(f.graphql,'shop',{...body,confirmCompatibility:true});assert.equal(saved.recommendations.cross[0].verified,true);assert.equal(saved.recommendations.cross[0].sku,'OTHER');assert.equal(f.product.variants[0].metadata.find(m=>m.key==='original').value,'keep');
 await assert.rejects(editProduct(f.graphql,'shop',{...body,confirmCompatibility:true,recommendations:{cross:[{sku:'MISSING',reason:'Причина'}],upsell:[]}}),{status:400});
 const upsell=await editProduct(f.graphql,'shop',{...body,recommendations:{cross:[],upsell:[{sku:'OTHER',reason:'Інша комплектація'}]}});assert.equal(upsell.recommendations.upsell.length,1);
});
