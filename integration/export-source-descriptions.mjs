import fs from 'node:fs/promises';
import {biPool,scopedRequest} from './bi-read.mjs';
const base=new URL('./',import.meta.url);
const folders=(await fs.readdir(new URL('exports/',base))).filter(v=>/^catalog-\d/.test(v)).sort().reverse();
if(!folders.length)throw new Error('Export the catalog first');
const data=JSON.parse(await fs.readFile(new URL('exports/'+folders[0]+'/catalog.local.json',base),'utf8'));
const pool=await biPool();
try{
 // Verified metadata mapping: the source form's description is Комментарий.
 const {request,scope}=scopedRequest(pool,[...new Set(data.catalogRows.map(r=>r.ProductRef))]);
 const rows=(await request.query(`WITH ${scope} SELECT RTRIM(n._Code) AS Code,n._Fld14064 AS Description FROM [vsmarket].dbo._Reference159 n JOIN Requested r ON r.ProductRef=n._IDRRef WHERE n._Fld771=0 AND n._Marked=0x00`)).recordset;
 const items=rows.map(row=>({sku:row.Code,description:String(row.Description||'').trim().slice(0,5000)})).filter(row=>row.description);
 // Staff-only review text; never copied into public product descriptions automatically.
 await fs.writeFile(new URL('source-descriptions.local.json',base),JSON.stringify({checkedAt:new Date().toISOString(),catalogSource:folders[0],items},null,2));
 console.log(JSON.stringify({checkedProducts:rows.length,sourceDescriptions:items.length}));
}catch(error){console.error('Source description export failed ('+(error.code||'VALIDATION')+').');process.exitCode=1;}
finally{await pool.close();}
