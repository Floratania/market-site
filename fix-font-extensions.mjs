import fs from 'node:fs/promises';
for(let i=0;i<5;i++)await fs.rename(`public/assets/inter-${i}.woff2`,`public/assets/inter-${i}.ttf`);
const p='public/assets/fonts.css'; await fs.writeFile(p,(await fs.readFile(p,'utf8')).replaceAll('.woff2','.ttf'));
