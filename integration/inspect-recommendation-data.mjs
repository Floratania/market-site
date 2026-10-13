const data=await(await fetch('http://127.0.0.1:8790/api/catalog')).json();
const keys=new Map();for(const p of data.products||[])for(const s of p.specifications||[]){const set=keys.get(s.key)||new Set();set.add(s.value);keys.set(s.key,set);}
console.log(JSON.stringify({products:data.products?.length,categories:[...new Set(data.products?.map(p=>p.category))],fields:[...keys].map(([key,values])=>({key,examples:[...values].slice(0,4)}))},null,2));
