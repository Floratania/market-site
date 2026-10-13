import fs from 'node:fs/promises';
for(const name of ['index.html','account.html']){
 const file=new URL('../public/'+name,import.meta.url);const html=await fs.readFile(file,'utf8');
 await fs.writeFile(file,html.replaceAll('?v=20261008-15','?v=20261008-16'));
}
