import fs from 'node:fs/promises';
const base=new URL('./',import.meta.url),report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',base),'utf8'));
const data=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,base),'utf8'));
const groups=new Map();
for(const row of data.catalogRows){const rows=groups.get(row.GroupName)||[];rows.push(row);groups.set(row.GroupName,rows);}
for(const [group,rows] of groups)console.log(JSON.stringify({group,count:rows.length,path:rows[0].GroupPath,kind:[...new Set(rows.map(row=>row.ConstructionKind))],names:rows.slice(0,2).map(row=>row.Name)}));
