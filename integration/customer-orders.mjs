export function customerOrders(records,owner){
 if(typeof owner!=='string'||!owner)return [];
 return records.filter(record=>record.order.customerId===owner).map(({order})=>({
  id:order.id,createdAt:order.createdAt,status:order.status||'received',statusUpdatedAt:order.statusUpdatedAt||null,delivery:order.delivery,location:order.location,
  shipping:order.shipping?{city:order.shipping.city,warehouse:order.shipping.warehouse}:null,
  payment:order.payment?{method:order.payment.method,label:order.payment.label,status:order.payment.status}:null,
  reserved:!!(order.status==='confirmed'&&order.commerce&&!order.commerce.released&&!order.commerce.settled),
  pricing:order.pricing?{subtotal:order.pricing.subtotal,discount:order.pricing.discount,total:order.pricing.total,promotion:order.pricing.promotion?{code:order.pricing.promotion.code,confirmation:order.pricing.promotion.confirmation}:null}:null,
  lines:order.lines.map(line=>({sku:line.sku,name:line.name,variantName:line.variantName,quantity:line.quantity,unitPrice:line.unitPrice,currency:line.currency,productUrl:line.productUrl||null})),
 }));
}
