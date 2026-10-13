const base='http://127.0.0.1:8790';
const demo=await fetch(base+'/?demo=1',{redirect:'manual'});console.log(JSON.stringify({demoRedirect:demo.status,location:demo.headers.get('location')}));
const c=await(await fetch(base+'/api/catalog')).json();console.log(JSON.stringify({products:c.products?.length,stockItems:c.stock?.length,updatedAt:c.stockSnapshotAt}));
try{const cities=await(await fetch(base+'/api/nova-poshta/cities?q='+encodeURIComponent('Чернівці'))).json();console.log(JSON.stringify({cities:cities.items?.length,error:cities.error}));if(cities.items?.length){const w=await(await fetch(base+'/api/nova-poshta/warehouses?cityRef='+cities.items[0].ref)).json();console.log(JSON.stringify({warehouses:w.items?.length,error:w.error}));}}catch{console.log('Delivery check failed');}
