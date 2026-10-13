import fs from 'node:fs/promises';
import {biPool,scopedRequest} from './bi-read.mjs';
const base=new URL('./',import.meta.url),details=JSON.parse(await fs.readFile(new URL('product-details-source.local.json',base),'utf8'));
const pool=await biPool();
try{
 const {request,scope}=scopedRequest(pool,details.products.map(p=>p.ProductRef));
 const result=await request.query(`WITH ${scope}
 SELECT CONVERT(varchar(34),f._IDRRef,1) FileRef,CONVERT(varchar(34),f._Fld14151RRef,1) ProductRef,
 f._Description FileName,f._Fld14162 Extension,f._Fld14160 FilePath,f._Fld14161 DeclaredSize,
 CONVERT(varchar(34),f._Fld14166RRef,1) StorageType,CONVERT(varchar(34),f._Fld14167RRef,1) VolumeRef,
 CONVERT(bit,f._Fld14155) Encrypted,DATALENGTH(f._Fld14168) StorageLength,
 CONVERT(varchar(130),SUBSTRING(f._Fld14168,1,64),1) StorageHeader,
 DATALENGTH(b._Fld8247) BinaryLength,CONVERT(varchar(130),SUBSTRING(b._Fld8247,1,64),1) BinaryHeader,
 CASE WHEN n._Fld14101RRef=f._IDRRef THEN 1 ELSE 0 END IsMain
 FROM [vsmarket].dbo._Reference161 f JOIN Requested r ON r.ProductRef=f._Fld14151RRef
 JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=r.ProductRef AND n._Fld771=f._Fld771
 LEFT JOIN [vsmarket].dbo._InfoRg8245 b ON b._Fld8246_RRRef=f._IDRRef AND b._Fld8246_TYPE=0x08 AND b._Fld8246_RTRef=0x000000A1 AND b._Fld771=f._Fld771
 WHERE f._Fld771=0 AND f._Marked=0x00 ORDER BY ProductRef,IsMain DESC,FileRef;`);
 await fs.writeFile(new URL('product-media-source.local.json',base),JSON.stringify({checkedAt:new Date().toISOString(),files:result.recordset},null,2));
 const groups={};for(const row of result.recordset){const key=`${row.Extension}|${row.StorageHeader?.slice(0,26)}|${row.BinaryHeader?.slice(0,26)}`;groups[key]=(groups[key]||0)+1;}
 console.log(JSON.stringify({files:result.recordset.length,main:result.recordset.filter(p=>p.IsMain).length,encrypted:result.recordset.filter(p=>p.Encrypted).length,groups,sample:result.recordset.slice(0,3)},null,2));
}finally{await pool.close();}
