const response=await fetch('http://127.0.0.1:8000/graphql/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query{__type(name:"Query"){fields{name args{name}}}}'})});
const result=await response.json();const field=result.data?.__type.fields.find(f=>f.name==='productVariant');
if(!field?.args.some(a=>a.name==='sku')||!field.args.some(a=>a.name==='channel'))throw new Error('SKU query not supported');
const catalog=await(await fetch('http://127.0.0.1:8790/api/catalog')).json();
const products=catalog.products||[];console.log(JSON.stringify({skuQuerySupported:true,products:products.length,withAlternatives:products.filter(p=>p.recommendations?.upsell.length).length}));
