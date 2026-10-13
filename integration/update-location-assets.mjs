import fs from 'node:fs/promises';
for(const name of ['index.html','account.html']){
 const file=new URL(`../public/${name}`,import.meta.url);
 let html=await fs.readFile(file,'utf8');
 html=html.replace(/\/locations.js\?v=[\w-]+/g,'/locations.js?v=20261008-20').replace(/\/app.js\?v=[\w-]+/g,'/app.js?v=20261008-20').replace(/\/brand.css\?v=[\w-]+/g,'/brand.css?v=20261008-20');
 html=html.replace(/\/product-media.css\?v=[\w-]+/g,'/product-media.css?v=20261008-20');
 html=html.replace('Геолокація — лише після вашого дозволу. Координати не зберігаємо. Можна обрати точку вручну.','Можна обрати точку вручну та переглянути автомобільний маршрут у Google Maps.');
 html=html.replace('<p class="location-map-note">','<p class="location-map-note" data-location-privacy>');
 await fs.writeFile(file,html);
}
try{await fs.copyFile(new URL('routing.example.json',import.meta.url),new URL('routing.local.json',import.meta.url),fs.constants?.COPYFILE_EXCL??1);}catch(error){if(error.code!=='EEXIST')throw error;}
console.log('Route UI and theme assets refreshed');
