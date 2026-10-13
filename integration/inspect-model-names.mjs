import fs from 'node:fs/promises';
const report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',import.meta.url),'utf8'));
const data=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,import.meta.url),'utf8'));
console.log(data.catalogRows.map(p=>p.Name).join('\n'));
