import fs from 'node:fs/promises';import sql from 'mssql';
import {buildExport,applyStockFilter,canonicalRef} from './catalog-export-format.mjs';
const base=new URL('./',import.meta.url),c=JSON.parse(await fs.readFile(new URL('bi-connection.local.json',base),'utf8'));
const options=JSON.parse(await fs.readFile(new URL('catalog-export.config.json',base),'utf8'));
const [server,instanceName]=c.server.split('\\');
const pool=await new sql.ConnectionPool({server,database:c.database,user:c.user,password:c.password,options:{encrypt:c.encrypt!==false,trustServerCertificate:c.trustServerCertificate===true,readOnlyIntent:true,...(instanceName&&!c.port?{instanceName}:{})},...(c.port?{port:c.port}:{})}).connect();
try{
 const type=(JSON.parse(await fs.readFile(new URL('price-types.local.json',base),'utf8'))).find(t=>canonicalRef(t.Ref)===canonicalRef(options.priceTypeRef));if(!type)throw new Error('Retail price type missing');
 const query=await fs.readFile(new URL('catalog-export.sql',base),'utf8');
 const now=await pool.request().query("SELECT CONVERT(varchar(33),GETDATE(),126) AsOf");
 const asOf=now.recordset[0].AsOf;
 const result=await pool.request().input('separator',sql.Int,options.dataSeparator).input('groupCode',sql.NVarChar(32),'26-00000148').input('priceType',sql.Binary(16),Buffer.from(type.Ref.slice(2),'hex')).input('asOf',sql.VarChar(33),asOf).query(query);
 if(result.recordsets.length!==4)throw new Error('Incomplete export');
 const targetProduct=result.recordsets[0].filter(r=>r.Code.trim()==='НФ-00001746');if(targetProduct.length!==1)throw new Error('Door screen source SKU missing or ambiguous');
 const ref=targetProduct[0].ProductRef;
 const payload=applyStockFilter(buildExport(targetProduct,result.recordsets[1].filter(r=>r.ProductRef===ref),result.recordsets[2].filter(r=>r.ProductRef===ref),type,asOf),result.recordsets[3].filter(r=>r.ProductRef===ref),false);
 const rows=payload.catalogRows.filter(r=>r.Code.trim()==='НФ-00001746'&&r.VariantRef==='0x00000000000000000000000000000000');
 if(payload.issues.length||rows.length!==1||rows[0].Name.trim()!=='Москітна сітка дверна')throw new Error('Review mosquito source scope before import');
 const target=new URL('mosquito-export.local.json',base);await fs.writeFile(target,JSON.stringify({...payload,catalogRows:rows},null,2));
 console.log(JSON.stringify({stockCheckedAt:payload.stockCheckedAt,issues:payload.issues.length,rows:rows.map(({Code,Name,Price,AvailableMamaivtsi,AvailableMagala,VariantRef})=>({Code,Name,Price,AvailableMamaivtsi,AvailableMagala,VariantRef}))}));
}finally{await pool.close();}
