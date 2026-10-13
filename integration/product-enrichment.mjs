// Explicit customer-facing properties only; source service flags never become attributes.
export const propertyDefinitions=[
 ['construction_kind','Вид конструкції'],['product_type','Тип конструкції'],['opening','Вид відкривання'],
 ['width','Ширина'],['height','Висота'],['opening_direction','Відкривання'],['color','Колір'],
 ['equipment','Комплектація'],['filling','Наповнення'],['profile_system','Профільна система'],
 ['leaf_count','Кількість стулок'],['design','Дизайн конструкції'],['lock','Замок'],['hinges','Петлі'],
 ['threshold','Поріг'],['handle','Ручка'],['model','Модель'],['film','Плівка'],
].map(([key,label])=>({key,label,numeric:['width','height'].includes(key),filterable:!['design','model','equipment','film'].includes(key)}));
const clean=value=>String(value??'').trim();
const numeric=value=>/^\d+(?:[.,]\d+)?$/.test(clean(value))&&Number(clean(value).replace(',','.'))>0?String(Number(clean(value).replace(',','.'))):null;
// In this 1C catalogue some doors use the first TWO entries of Д×Ш×В:
// LengthRaw is the door width, WidthRaw is its height, HeightRaw is empty.
// Only accept this orientation when the source name confirms the same pair.
function dimensionsFromFields(product,issues){
 const width=numeric(product.WidthRaw),height=numeric(product.HeightRaw),length=numeric(product.LengthRaw);
 if(!height&&length&&width){
  const pair=clean(product.Name).match(/\b(\d{3,4})\s*[*xх×]\s*(\d{3,4})\b/i);
  const isWindowOrDoor=/^(?:Двері|Вікн[оа])(?:\s|$)/i.test(clean(product.Name))||/^(?:Двер|Вікн)/i.test(clean(product.GroupName));
  if(isWindowOrDoor&&pair&&numeric(pair[1])===length&&numeric(pair[2])===width){
   return {width:{value:length,source:'gabarit:length'},height:{value:width,source:'gabarit:width'}};
  }
  issues.push({productRef:product.ProductRef,reason:'ambiguous-gabarit-dimensions',length,width,namePair:pair?.slice(1)||null});
  return {};
 }
 return {width:{value:width,source:'field:width'},height:{value:height,source:'field:height'}};
}
export function enrichmentFor(source){
 const issues=[],result=[];
 const names=new Map(propertyDefinitions.map(d=>[d.label,d]));
 const byProduct=new Map();
 for(const row of source.properties){
  if(!names.has(row.PropertyName))continue;
  const rows=byProduct.get(row.ProductRef)||[];rows.push(row);byProduct.set(row.ProductRef,rows);
 }
 for(const product of source.products){
  const specs=[],dimensionSources={},fields=dimensionsFromFields(product,issues);
  for(const def of propertyDefinitions){
   const rows=(byProduct.get(product.ProductRef)||[]).filter(r=>r.PropertyName===def.label);
   const values=[...new Set(rows.map(row=>row.ValueType==='0x08'&&row.ReferenceType==='0x0000006C'?clean(row.ReferencedValue):'').filter(Boolean))];
   let value=values.length===1?values[0]:null;
   if(values.length>1)issues.push({productRef:product.ProductRef,key:def.key,reason:'conflicting-properties',values});
   if(value&&/вияснити|з['’]?ясувати|уточнити|^\?+$/i.test(value)){issues.push({productRef:product.ProductRef,key:def.key,reason:'unresolved-value'});value=null;}
   if(def.numeric){
    const fromProperty=numeric(value),fromField=fields[def.key]?.value,fieldSource=fields[def.key]?.source;
    if(fromProperty&&fromField&&fromProperty!==fromField&&!fieldSource.startsWith('gabarit:')){issues.push({productRef:product.ProductRef,key:def.key,reason:'dimension-conflict',property:fromProperty,field:fromField});value=null;}
    else if(values.length>1)value=null;
    else value=fromProperty||fromField;
    if(value)dimensionSources[def.key]=fromProperty?'property':fieldSource;
   }
   if(value)specs.push({key:def.key,label:def.label,value,...(def.numeric?{unit:'мм'}:{}),filterable:def.filterable});
  }
  result.push({productRef:product.ProductRef,specs,dimensionSources,...(fields.width?.source==='gabarit:length'?{dimensionLayout:'gabarit:length-width'}:{})});
 }
 return {checkedAt:source.checkedAt,dimensionUnit:'mm',products:result,issues};
}
export function uniqueProductPhotos(photos){
 const seen=new Set();return [...photos].sort((a,b)=>Number(b.isMain)-Number(a.isMain)||a.fileRef.localeCompare(b.fileRef)).filter(p=>{if(seen.has(p.sha256))return false;seen.add(p.sha256);return true;});
}
