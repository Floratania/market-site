import fs from 'node:fs/promises';
import sql from 'mssql';
const base=new URL('./',import.meta.url);
const config=JSON.parse((await fs.readFile(new URL('bi-connection.local.json',base),'utf8')).replace(/^\uFEFF/,''));
const [server,instanceName]=config.server.split('\\');
const pool=new sql.ConnectionPool({server,database:config.database,user:config.user,password:config.password,
 ...(config.port?{port:config.port}:{}),options:{encrypt:config.encrypt!==false,trustServerCertificate:config.trustServerCertificate===true,readOnlyIntent:true,...(instanceName&&!config.port?{instanceName}:{})},connectionTimeout:10000,requestTimeout:30000});
try{
 await pool.connect();
 const result=await pool.request().query(`SELECT RTRIM(w._Code) AS Code,d._Fld16096 AS Presentation,d._Fld16097 AS Fields,d._Fld16105 AS Value
 FROM [vsmarket].dbo._Reference251 w JOIN [vsmarket].dbo._Reference251_VT16092 d ON d._Reference251_IDRRef=w._IDRRef AND d._Fld771=w._Fld771
 WHERE w._Fld771=0 AND w._Marked=0x00 AND w._Code IN(N'26-000004',N'26-000005');`);
 await fs.writeFile(new URL('warehouse-contacts.local.json',base),JSON.stringify(result.recordset,null,2));
 console.log(JSON.stringify({contactRows:result.recordset.length,addressCandidates:result.recordset.filter(row=>/вул|улиц|street|postal/i.test(row.Presentation||'')).map(row=>({code:row.Code,address:row.Presentation}))}));
}catch(error){console.error(`Warehouse source inspection failed (${error.code||'SQL'},${error.number||0})`);process.exitCode=1;}finally{await pool.close();}
