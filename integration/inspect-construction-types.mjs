const {products}=await(await fetch('http://127.0.0.1:8790/api/catalog')).json();
const groups={};
for(const p of products)for(const s of p.specifications||[])if(/тип|вид/i.test(s.label)){const key=p.category+' / '+s.key+' / '+s.label;(groups[key]??=new Set()).add(s.value);}
console.log(JSON.stringify(Object.fromEntries(Object.entries(groups).map(([category,values])=>[category,[...values]])),null,2));
