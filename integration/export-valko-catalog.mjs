import fs from 'node:fs/promises';import sql from 'mssql';import {biPool} from './bi-read.mjs';import {buildExport,applyStockFilter} from './catalog-export-format.mjs';
const base=new URL('./',import.meta.url),options=JSON.parse(await fs.readFile(new URL('catalog-export.config.json',base),'utf8')),types=JSON.parse(await fs.readFile(new URL('price-types.local.json',base),'utf8')),type=types.find(t=>t.Ref===options.priceTypeRef);if(!type)throw new Error('Retail price missing');
const pool=await biPool();try{const now=(await pool.request().query('SELECT CONVERT(varchar(33),GETDATE(),126) AsOf')).recordset[0].AsOf;
const query=await fs.readFile(new URL('catalog-export.sql',base),'utf8');
const r=await pool.request().input('separator',sql.Int,0).input('groupCode',sql.NVarChar(32),'26-00000143').input('priceType',sql.Binary(16),Buffer.from(type.Ref.slice(2),'hex')).input('asOf',sql.VarChar(33),now).query(query);
const payload=applyStockFilter(buildExport(...r.recordsets.slice(0,3),type,now),r.recordsets[3],false);await fs.writeFile(new URL('valko-export.local.json',base),JSON.stringify(payload));
console.log(JSON.stringify({total:payload.products.length,available:payload.catalogRows.filter(r=>r.Price&&(Number(r.AvailableMamaivtsi)>0||Number(r.AvailableMagala)>0)).map(({Code,Name,GroupName,Price,AvailableMamaivtsi,AvailableMagala,VariantRef})=>({Code,Name,GroupName,Price,AvailableMamaivtsi,AvailableMagala,VariantRef})),issues:payload.issues},null,2));
}finally{await pool.close();}
