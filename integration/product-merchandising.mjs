export function variantPhotos(variant){
 const override=variant.metadata?.find(m=>m.key==='storefront_media_override');
 if(override){try{return JSON.parse(override.value).map((url,i)=>({id:'manual-'+i,url,alt:variant.name||''}));}catch{}}
 return variant.media||[];
}
export function variantPromotion(variant){try{return JSON.parse(variant.metadata?.find(m=>m.key==='storefront_promotion')?.value||'null');}catch{return null;}}
export function validatePhotos(photos){
 if(!Array.isArray(photos)||photos.length>12)throw Object.assign(new Error('Додайте до 12 фотографій.'),{status:400});
 return [...new Set(photos.map(value=>{if(typeof value!=='string'||value.length>2000)throw Object.assign(new Error('Перевірте посилання фото.'),{status:400});if(/^\/assets\/uploads\/[0-9a-f-]{36}\.(png|jpg)$/.test(value))return value;try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}throw Object.assign(new Error('Фото: HTTPS-посилання або завантажений файл.'),{status:400});}))];
}
