const base='http://127.0.0.1:8790';
for(const path of ['/products/demo-window-1?demo=1','/products/demo-door-1?demo=1','/products/missing?demo=1','/catalog-demo.json']){
 const response=await fetch(base+path);
 const body=await response.text();
 console.log(response.status,path,response.headers.get('content-type'),body.match(/<title>([^<]*)<\/title>/)?.[1] || '');
 if(path.includes('missing') ? response.status!==404 : response.status!==200)throw new Error('Unexpected product-page response');
}
