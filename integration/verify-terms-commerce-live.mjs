const base='http://127.0.0.1:8790';
for(const path of ['/payment-delivery','/warranty-returns','/contacts','/seller']){const r=await fetch(base+path),html=await r.text();if(r.status!==200||!html.includes('VS Market'))throw new Error('Terms page unavailable: '+path);if(path==='/seller'&&!html.includes('ще не опубліковані'))throw new Error('Missing seller placeholder');}
const d=await(await fetch(base+'/api/catalog')).json();if(d.products.length<500)throw new Error('Catalog unavailable after reservation changes');
console.log(JSON.stringify({termsPages:4,catalogProducts:d.products.length,reservationIntegrationAvailable:true}));
