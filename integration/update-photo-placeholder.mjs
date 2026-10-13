import {readFile,writeFile} from 'node:fs/promises';
const app=new URL('../public/app.js',import.meta.url);
let js=await readFile(app,'utf8');
js=js.replaceAll('Фото товару очікується','Фото не знайдено в базі даних').replaceAll('Фото очікується','Фото не знайдено в базі даних');
if((js.match(/Фото не знайдено в базі даних/g)||[]).length!==2)throw new Error('Expected catalog and product photo placeholders');
await writeFile(app,js);
const index=new URL('../public/index.html',import.meta.url);
await writeFile(index,(await readFile(index,'utf8')).replace('/app.js?v=20261008-4','/app.js?v=20261008-5'));
console.log('Updated both photo placeholders and storefront script version.');
