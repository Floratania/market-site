import {specificationsFor} from './catalog-specifications.mjs';
import {productDescription} from './product-description.mjs';
import {recommendationSettings} from './recommendations.mjs';
import {variantPhotos,variantPromotion,validatePhotos} from './product-merchandising.mjs';
export const manualPriceKey=channel=>'storefront_price:'+channel;
export function manualPrice(metadata,channel){const value=metadata?.find(item=>item.key===manualPriceKey(channel))?.value;return typeof value==='string'&&/^\d+(?:\.\d{1,2})?$/.test(value)&&Number(value)>0?Number(value):null;}
const problem=(status,message)=>Object.assign(new Error(message),{status});
const QUERY=`query ManageProductEditor($id:ID!,$channel:String!){product(id:$id,channel:$channel){id name description metadata{key value} privateMetadata{key value} channelListings{channel{id slug}} variants{id name sku media{id url alt} metadata{key value} privateMetadata{key value} channelListings{channel{id slug} price{amount currency}}}}}`;
const checked=result=>{if(!result||result.errors?.length)throw problem(409,'Не вдалося зберегти зміни. Оновіть дані й перевірте поля.');return result;};
const ids=body=>{if(!body||![body.productId,body.variantId].every(value=>typeof value==='string'&&value.length>0&&value.length<=200))throw problem(400,'Перевірте модель і комплектацію.');};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw problem(400,'Перевірте заповнені поля.');return value.trim();};
const merge=(items,input)=>[...(items||[]).filter(item=>!input.some(next=>next.key===item.key)),...input];
const editorText=value=>JSON.stringify({blocks:value.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=>({id:'text-'+index,type:'paragraph',data:{text:paragraph.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}}))});
async function read(graphql,channel,body){
 ids(body);const {product}=await graphql(QUERY,{id:body.productId,channel});
 const listing=product?.channelListings?.find(item=>item.channel.slug===channel),variant=product?.variants?.find(item=>item.id===body.variantId);
 const price=variant?.channelListings?.find(item=>item.channel.slug===channel)?.price;
 if(!product||!listing||!variant||!price||price.currency!=='UAH')throw problem(404,'Ця комплектація не належить каталогу магазину.');
 return {product,variant,listing,price:Number(price.amount)};
}
export async function getProductEditor(graphql,channel,body,sourcePrice=async()=>null,sourceDescription=async()=>''){
 const {product,variant,price}=await read(graphql,channel,body);
 const specifications=specificationsFor(product.metadata,variant.metadata),opening=specifications.find(s=>s.key==='opening');
 // Earlier versions stored R/L in the opening-kind field. Read them as a side.
 if(opening&&/^[RL]$/i.test(opening.value)){
  const side=specifications.find(s=>s.key==='opening_direction');
  if(side)side.value=opening.value.toUpperCase();else specifications.push({key:'opening_direction',label:'Сторона відкривання',value:opening.value.toUpperCase(),filterable:true,scope:'variant'});
  specifications.splice(specifications.indexOf(opening),1);
 }
 return {productId:product.id,variantId:variant.id,name:product.name,description:productDescription(product.description),sourceDescription:await sourceDescription(variant.sku),sku:variant.sku,variantName:variant.name,price,priceMode:manualPrice(variant.privateMetadata,channel)==null?'source':'manual',sourcePrice:await sourcePrice(variant.sku),specifications,recommendations:recommendationSettings(variant.metadata),photos:variantPhotos(variant),promotion:variantPromotion(variant)};
}
export async function editProduct(graphql,channel,body,sourcePrice=async()=>null,sourceDescription=async()=>''){
 if(!['model','specifications','price','recommendations','photos','promotion'].includes(body?.section))throw problem(400,'Невідомий розділ редагування.');
 const {product,variant,listing,price:previousPrice}=await read(graphql,channel,body);
 if(body.section==='photos'){
  const value=body.useSource?'':JSON.stringify(validatePhotos(body.photos));
  checked((await graphql('mutation ManagePhotos($id:ID!,$input:[MetadataInput!]!){updateMetadata(id:$id,input:$input){errors{code}}}',{id:variant.id,input:[{key:'storefront_media_override',value}]})).updateMetadata);
 }
 if(body.section==='promotion'){
  const old=variantPromotion(variant),originalPrice=old?.originalPrice||previousPrice,originalMode=old?.originalMode||(manualPrice(variant.privateMetadata,channel)==null?'source':'manual'),label=text(body.label||'Акція',100,true);
  if(body.enabled&&(typeof body.price!=='number'||!Number.isFinite(body.price)||body.price<=0||body.price>=originalPrice))throw problem(400,'Акційна ціна має бути нижчою за звичайну.');
  const priceBody={...body,section:'price',mode:body.enabled?'manual':old?.originalMode||'source',price:body.enabled?body.price:originalPrice};
  await editProduct(graphql,channel,priceBody,sourcePrice,sourceDescription);
  try{checked((await graphql('mutation ManagePromotion($id:ID!,$input:[MetadataInput!]!){updateMetadata(id:$id,input:$input){errors{code}}}',{id:variant.id,input:[{key:'storefront_promotion',value:body.enabled?JSON.stringify({originalPrice,originalMode,label}):''}]})).updateMetadata);}catch(e){await editProduct(graphql,channel,{...body,section:'price',mode:'manual',price:previousPrice},sourcePrice,sourceDescription);throw e;}
 }
 if(body.section==='recommendations'){
  const input=body.recommendations;if(!input||!Array.isArray(input.cross)||!Array.isArray(input.upsell)||input.cross.length>3||input.upsell.length>3)throw problem(400,'Оберіть до трьох товарів у кожному розділі.');
  if(input.cross.length&&body.confirmCompatibility!==true)throw problem(400,'Підтвердіть сумісність супутніх товарів.');
  const saved={cross:[],upsell:[]};
  for(const kind of ['cross','upsell']){
   const seen=new Set();
   for(const item of input[kind]){
    const sku=text(item.sku,100,true),reason=text(item.reason,300,true);
    if(sku===variant.sku||seen.has(sku))throw problem(400,'Не додавайте поточний артикул або дублікати.');seen.add(sku);
    const result=await graphql('query RecommendationCandidate($sku:String!,$channel:String!){productVariant(sku:$sku,channel:$channel){id pricing{price{gross{amount}}} product{channelListings{channel{slug} isPublished}}}}',{sku,channel});
    const candidate=result.productVariant,amount=candidate?.pricing?.price?.gross?.amount;
    if(!candidate||!candidate.product.channelListings.some(c=>c.channel.slug===channel&&c.isPublished)||!Number.isFinite(amount)||amount<=0)throw problem(400,'Рекомендований артикул не опублікований або не має ціни.');
    if(kind==='upsell'&&amount<=previousPrice)throw problem(400,'Альтернатива має бути дорожчою за поточну комплектацію.');
    saved[kind].push({sku,reason,...(kind==='cross'?{verified:true}:{})});
   }
  }
  checked((await graphql('mutation ManageRecommendations($id:ID!,$input:[MetadataInput!]!){updateMetadata(id:$id,input:$input){errors{code}}}',{id:variant.id,input:[{key:'storefront_recommendations',value:JSON.stringify(saved)}]})).updateMetadata);
 }
 if(body.section==='model'){
  const name=text(body.name,200,true),description=text(body.description,5000);
  checked((await graphql(`mutation ManageProductText($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{code}}}`,{id:product.id,input:{name,description:editorText(description),privateMetadata:merge(product.privateMetadata,[{key:'storefront_name_override',value:name}])}})).productUpdate);
 }
 if(body.section==='specifications'){
  let input=body.specifications;if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['width','height','color','opening','opening_direction','type'].includes(key)))throw problem(400,'Перевірте параметри комплектації.');
  const oldSide=typeof input.opening==='string'&&/^[RL]$/i.test(input.opening.trim());
  const existingSide=specificationsFor(product.metadata,variant.metadata).find(s=>s.key==='opening_direction')?.value||'';
  input={...input,opening_direction:input.opening_direction??(oldSide?input.opening.trim().toUpperCase():existingSide),opening:oldSide?'':input.opening};
  if(input.opening_direction&&!['R','L'].includes(input.opening_direction))throw problem(400,'Оберіть праву або ліву сторону відкривання.');
  const current=specificationsFor(product.metadata,variant.metadata),typeKey=current.some(item=>item.key==='construction_type')?'construction_type':'product_type';
  const specs=[];
  for(const [key,label] of [['width','Ширина'],['height','Висота'],['color','Колір'],['opening','Вид відкривання'],['opening_direction','Сторона відкривання'],['type','Тип конструкції']]){
   const value=text(input[key],150);
   if(['width','height'].includes(key)&&value&&(!/^\d+$/.test(value)||Number(value)<1||Number(value)>20000))throw problem(400,'Розміри мають бути цілими числами від 1 до 20000 мм.');
   specs.push({key:key==='type'?typeKey:key,label,value,unit:['width','height'].includes(key)?'мм':'',filterable:true});
  }
  const dimensions=[input.width.trim(),input.height.trim()].filter(Boolean).join(' × ');
  const variantName=[dimensions?dimensions+' мм':'',input.color.trim(),input.opening.trim(),input.opening_direction.trim()].filter(Boolean).join(' · ').slice(0,255)||variant.sku;
  checked((await graphql(`mutation ManageProductSpecifications($id:ID!,$input:ProductVariantInput!){productVariantUpdate(id:$id,input:$input){errors{code}}}`,{id:variant.id,input:{name:variantName,metadata:merge(variant.metadata,[{key:'storefront_specs',value:JSON.stringify(specs)}]),privateMetadata:merge(variant.privateMetadata,[{key:'storefront_variant_name_override',value:variantName}])}})).productVariantUpdate);
 }
 if(body.section==='price'){
  if(!['manual','source'].includes(body.mode))throw problem(400,'Оберіть спосіб оновлення ціни.');
  const value=body.mode==='source'?await sourcePrice(variant.sku):body.price;
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>100000000||Math.abs(value*100-Math.round(value*100))>0.000001)throw problem(400,body.mode==='source'?'Ціна з прайсу поки недоступна.':'Вкажіть додатну ціну з точністю до копійок.');
  const updatePrice=async amount=>checked((await graphql(`mutation ManageProductPrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{code}}}`,{id:variant.id,input:[{channelId:listing.channel.id,price:amount}] })).productVariantChannelListingUpdate);
  await updatePrice(value);
  try{
   checked((await graphql(`mutation ManageProductPriceMode($id:ID!,$input:[MetadataInput!]!){updatePrivateMetadata(id:$id,input:$input){errors{code}}}`,{id:variant.id,input:[{key:manualPriceKey(channel),value:body.mode==='manual'?String(value):''}]})).updatePrivateMetadata);
  }catch(error){try{await updatePrice(previousPrice);}catch{throw problem(503,'Збереження ціни не завершено. Оновіть дані та повторіть дію.');}throw error;}
 }
 return getProductEditor(graphql,channel,body,sourcePrice,sourceDescription);
}
