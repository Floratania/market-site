import fs from 'node:fs/promises';
const html=await fs.readFile('public/index.html','utf8');
const files=new Set(['/','/showroom.css','/app.js',...Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g),m=>m[1])]);
for(const path of files) {
 const r=await fetch(`http://127.0.0.1:8790${path}`);
 console.log(r.status,path,r.headers.get('content-type'));
 if(!r.ok)process.exitCode=1;
}
