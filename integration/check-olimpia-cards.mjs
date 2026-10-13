const response=await fetch('http://127.0.0.1:8790/api/catalog');
const data=await response.json();
console.log(JSON.stringify(data.products.filter(p=>/T[12]\s+Olimpia/i.test(p.name+' '+p.variantName)).map(p=>({id:p.id,model:p.productId,name:p.name,sku:p.sku,price:p.price,spec:p.specifications.filter(s=>['color','width','height','opening_direction'].includes(s.key))})),null,2));
