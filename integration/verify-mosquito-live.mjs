const response=await fetch('http://127.0.0.1:8790/api/catalog');if(!response.ok)throw new Error('Catalog unavailable');
const data=await response.json(),p=data.products.find(p=>p.sku==='НФ-00001746');
const doors=data.products.filter(p=>p.category==='Двері'&&p.recommendations?.related.some(x=>x.sku==='НФ-00001746'));
const stock=data.stock?.filter(s=>s.sku==='НФ-00001746')||[];
if(!p||p.price!==1295||p.category!=='Москітні сітки'||!doors.length||stock.find(s=>s.location==='mamaivtsi')?.quantity!==1)throw new Error('Mosquito storefront verification failed');
const page=await fetch('http://127.0.0.1:8790/products/'+encodeURIComponent(p.slug));if(page.status!==200)throw new Error('Mosquito product page unavailable');
console.log(JSON.stringify({products:data.products.length,mesh:{sku:p.sku,slug:p.slug,price:p.price,category:p.category,stock},doorsWithSuggestion:doors.length,example:doors[0].sku,pageStatus:page.status}));
