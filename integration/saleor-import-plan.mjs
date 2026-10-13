import {canonicalRef,zeroRef} from './catalog-export-format.mjs';
import categories from './saleor-category-map.json' with {type:'json'};
export function planImport(data){
 if(data.schemaVersion!==1||data.rules.onlyInStock!==true||data.priceType.CurrencyCode!=='980'||data.priceType.CurrencyName!=='UAH'||data.priceType.IncludesVAT!==true)throw new Error('Unsupported catalog import scope or currency');
 if(data.summary.unknownStockVariantRows||data.issues.length)throw new Error('Resolve export issues before importing');
 if(!Number.isFinite(Date.parse(data.stockCheckedAt))||Date.now()-Date.parse(data.stockCheckedAt)>3600000)throw new Error('Refresh the stock export before importing');
 const seen=new Set(),plans=[];
 for(const row of data.catalogRows){
   if(row.VariantRef!==zeroRef)throw new Error('Variant import mapping requires separate review');
   const ref=canonicalRef(row.ProductRef),sku=row.Code.trim();
   if(!sku||sku.length>100||seen.has(sku))throw new Error('Duplicate or invalid source SKU');seen.add(sku);
   const stocks=[['mamaivtsi',row.AvailableMamaivtsi,row.ReservedMamaivtsi],['magala',row.AvailableMagala,row.ReservedMagala]].map(([location,available,reserved])=>{
     const quantity=Number(available);
     if(!Number.isInteger(quantity)||quantity>2147483647||!Number.isFinite(Number(reserved)))throw new Error('Saleor requires integer warehouse quantities');
     return {location,quantity:Math.max(0,quantity),rawAvailable:available,reserved};
   });
   if(!stocks.some(row=>row.quantity>0))throw new Error('Out-of-stock row must not be imported');
   const path=String(row.GroupPath||'').split(' / ').slice(1);
   const kind=String(row.ConstructionKind||'');
   const category=categories[row.GroupName]||(/вікн/i.test(kind)||path.find(group=>/вікн/i.test(group))?'Вікна':/двер/i.test(kind)||path.find(group=>/двер/i.test(group))?'Двері':'Вікна та двері');
   const metadata=[{key:'source_group',value:row.GroupName||''},{key:'article',value:row.Article||sku}];
   if(kind)metadata.push({key:'public_specs',value:JSON.stringify([{key:'construction_kind',label:'Вид конструкції',value:kind,filterable:true}])});
   const privateMetadata=[{key:'integration',value:'vsmarket-1c'},{key:'1c_product_ref',value:ref},{key:'1c_variant_ref',value:zeroRef},
     {key:'1c_price_type_ref',value:data.priceType.Ref},{key:'1c_stock_snapshot_at',value:data.stockCheckedAt},
     {key:'1c_dimensions_raw',value:JSON.stringify({width:row.WidthRaw,height:row.HeightRaw})}];
   const price=row.Price;
   if(price!==null&&(!/^\d+(?:\.\d{1,2})?$/.test(price)||Number(price)<=0))throw new Error('Invalid UAH selling price');
   plans.push({name:row.Name,sku,ref,slug:`1c-${ref.slice(2).toLowerCase()}`,externalReference:`vsmarket:${ref}`,
     variantExternalReference:`vsmarket:${ref}:${zeroRef}`,category,metadata,privateMetadata,stocks,price,
     publish:price!==null});
 }
 return plans;
}
