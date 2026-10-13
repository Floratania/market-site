const base='http://127.0.0.1:8790',d=await(await fetch(base+'/api/catalog')).json(),p=d.products.find(p=>p.sku==='НФ-00000973');
const r=await fetch(base+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:[{sku:p.sku,quantity:1}]})}),q=await r.json();
console.log(JSON.stringify({image:p.image,media:p.media,quoteImage:q.lines?.[0].image}));if(p.image){const img=await fetch(p.image);console.log(JSON.stringify({status:img.status,type:img.headers.get('content-type')}));}
