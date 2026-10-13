import fs from 'node:fs/promises';
import {biPool,scopedRequest} from './bi-read.mjs';
const base=new URL('./',import.meta.url),report=JSON.parse(await fs.readFile(new URL('saleor-import-result.local.json',base),'utf8'));
const input=JSON.parse(await fs.readFile(new URL(`exports/${report.source}/catalog.local.json`,base),'utf8'));
const pool=await biPool();
try{
 const schema=await pool.request().query(`SELECT o.name AS ObjectName,c.name AS ColumnName,t.name AS DataType
 FROM [vsmarket].sys.objects o JOIN [vsmarket].sys.columns c ON c.object_id=o.object_id JOIN [vsmarket].sys.types t ON t.user_type_id=c.user_type_id
 WHERE o.type='U' AND o.name IN(N'_Reference161',N'_Reference275',N'_InfoRg8245',N'_Chrc747',N'_Reference108') ORDER BY o.name,c.column_id;`);
 await fs.writeFile(new URL('product-media-schema.local.json',base),JSON.stringify(schema.recordset,null,2));
 console.log(JSON.stringify(schema.recordset.filter(row=>row.ObjectName!=='_Chrc747'&&row.ObjectName!=='_Reference108'),null,2));
 const {request,scope}=scopedRequest(pool,input.products.map(row=>row.ProductRef));
 const result=await request.query(`WITH ${scope}
 SELECT CONVERT(varchar(34),n._IDRRef,1) AS ProductRef,n._Code AS Code,n._Description AS Name,
 CONVERT(varchar(34),n._Fld14101RRef,1) AS MainImageRef,n._Fld14105 AS WidthRaw,n._Fld14047 AS HeightRaw,n._Fld14051 AS LengthRaw
 FROM [vsmarket].dbo._Reference159 n JOIN Requested r ON r.ProductRef=n._IDRRef WHERE n._Fld771=0;
 WITH ${scope}
 SELECT CONVERT(varchar(34),d._Reference159_IDRRef,1) AS ProductRef,
 CONVERT(varchar(34),d._Fld14135RRef,1) AS PropertyRef,p._Description AS PropertyName,
 CONVERT(varchar(4),d._Fld14136_TYPE,1) AS ValueType,d._Fld14136_S AS StringValue,
 CONVERT(varchar(40),d._Fld14136_N) AS NumberValue,CONVERT(bit,d._Fld14136_L) AS BooleanValue,
 CONVERT(varchar(10),d._Fld14136_RTRef,1) AS ReferenceType,
 CONVERT(varchar(34),d._Fld14136_RRRef,1) AS ValueRef,v._Description AS ReferencedValue,d._Fld14137 AS TextValue
 FROM [vsmarket].dbo._Reference159_VT14133 d JOIN Requested r ON r.ProductRef=d._Reference159_IDRRef
 LEFT JOIN [vsmarket].dbo._Chrc747 p ON p._IDRRef=d._Fld14135RRef AND p._Fld771=d._Fld771
 LEFT JOIN [vsmarket].dbo._Reference108 v ON v._IDRRef=d._Fld14136_RRRef AND v._Fld771=d._Fld771 AND d._Fld14136_RTRef=0x0000006C AND v._Marked=0x00
 WHERE d._Fld771=0 ORDER BY ProductRef,PropertyName;`);
 await fs.writeFile(new URL('product-details-source.local.json',base),JSON.stringify({checkedAt:new Date().toISOString(),products:result.recordsets[0],properties:result.recordsets[1]},null,2));
 const count={};for(const row of result.recordsets[1]){const item=count[row.PropertyName]||{rows:0,types:new Set(),sample:[]};item.rows++;item.types.add(row.ValueType);if(item.sample.length<3)item.sample.push(row.ReferencedValue||row.StringValue||row.NumberValue);count[row.PropertyName]=item;}
 console.log(JSON.stringify({products:result.recordsets[0].length,mainImageRefs:result.recordsets[0].filter(row=>row.MainImageRef!=='0x00000000000000000000000000000000').length,widths:result.recordsets[0].filter(row=>Number(row.WidthRaw)>0).length,heights:result.recordsets[0].filter(row=>Number(row.HeightRaw)>0).length,properties:Object.fromEntries(Object.entries(count).map(([key,item])=>[key,{...item,types:[...item.types]}]))},null,2));
}catch(error){console.error(`Details inspection failed (${error.code||'VALIDATION'},${error.number||0}): ${error.code?'source SQL unavailable':error.message}`);process.exitCode=1;}finally{await pool.close();}
