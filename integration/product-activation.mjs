export const disabledKey=channel=>'storefront_disabled:'+channel;
export const manuallyDisabled=(metadata,channel)=>metadata?.some(item=>item.key===disabledKey(channel)&&item.value==='true')===true;
const problem=(status,message)=>Object.assign(new Error(message),{status});
const PRODUCT=`query ManageActivationProduct($id:ID!,$channel:String!){product(id:$id,channel:$channel){id privateMetadata{key value} channelListings{channel{id slug} isPublished}}}`;
const METADATA=`mutation ManageActivationFlag($id:ID!,$input:[MetadataInput!]!){updatePrivateMetadata(id:$id,input:$input){errors{code}}}`;
const LISTING=`mutation ManageActivationListing($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){product{id channelListings{channel{slug} isPublished}} errors{code}}}`;
function checked(result){if(!result||result.errors?.length)throw problem(409,'Не вдалося змінити активність товару. Оновіть дані та спробуйте ще раз.');return result;}
export async function setProductActivation(graphql,channel,body){
 if(!body||typeof body.productId!=='string'||!body.productId||body.productId.length>200||typeof body.active!=='boolean')throw problem(400,'Перевірте товар і його активність.');
 const {product}=await graphql(PRODUCT,{id:body.productId,channel});
 const listing=product?.channelListings?.find(item=>item.channel.slug===channel);
 if(!product||!listing)throw problem(404,'Товар не належить цьому каталогу.');
 const key=disabledKey(channel),previous=product.privateMetadata?.find(item=>item.key===key)?.value||'false';
 // Keep the manual choice for future imports without overwriting other metadata.
 checked((await graphql(METADATA,{id:product.id,input:[{key,value:String(!body.active)}]})).updatePrivateMetadata);
 try{
  const update=checked((await graphql(LISTING,{id:product.id,input:{updateChannels:[{channelId:listing.channel.id,isPublished:body.active}]}})).productChannelListingUpdate);
  const saved=update.product?.channelListings?.find(item=>item.channel.slug===channel);
  if(saved?.isPublished!==body.active)throw problem(503,'Не вдалося підтвердити зміну активності. Оновіть дані.');
 }catch(error){
  // If publication fails, undo the import flag. Retrying either desired state is safe.
  try{checked((await graphql(METADATA,{id:product.id,input:[{key,value:previous}]})).updatePrivateMetadata);}catch{throw problem(503,'Зміна не завершена. Оновіть дані й повторіть дію, щоб узгодити активність товару.');}
  throw error;
 }
 return {productId:product.id,active:body.active};
}
