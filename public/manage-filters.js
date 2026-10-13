export function filterManageProducts(products,query='',filter='all'){
 const q=query.trim().toLocaleLowerCase('uk');
 return products.filter(p=>(!q||`${p.name} ${p.variantName} ${p.sku}`.toLocaleLowerCase('uk').includes(q))&&
  (filter!=='photo'||!(p.image||p.media?.length))&&
  (filter!=='promotion'||!!p.promotion)&&
  (filter!=='description'||!p.description?.trim())&&
  (filter!=='price'||!Number.isFinite(p.price)||p.price<=0)&&
  (filter!=='type'||!p.specifications?.some(s=>s.key==='product_type'&&s.value))&&
  (filter!=='active'||p.active!==false)&&(filter!=='inactive'||p.active===false));
}
