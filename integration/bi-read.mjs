import fs from 'node:fs/promises';
import sql from 'mssql';
export async function biPool(){
 const config=JSON.parse((await fs.readFile(new URL('bi-connection.local.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
 if(['server','database','user','password'].some(key=>!config[key]))throw new Error('Missing local SQL credentials');
 const [server,instanceName]=config.server.split('\\');
 const pool=new sql.ConnectionPool({server,database:config.database,user:config.user,password:config.password,...(config.port?{port:config.port}:{}),
   options:{encrypt:config.encrypt!==false,trustServerCertificate:config.trustServerCertificate===true,readOnlyIntent:true,...(instanceName&&!config.port?{instanceName}:{})},connectionTimeout:10000,requestTimeout:120000,pool:{max:1,min:0}});
 await pool.connect();return pool;
}
export function scopedRequest(pool,refs){
 const request=pool.request();
 refs.forEach((ref,i)=>{if(!/^0x[0-9a-f]{32}$/i.test(ref))throw new Error('Invalid catalog reference');request.input(`ref${i}`,sql.Binary(16),Buffer.from(ref.slice(2),'hex'));});
 return {request,scope:`Requested AS (SELECT ProductRef FROM (VALUES ${refs.map((_,i)=>`(@ref${i})`).join(',')}) v(ProductRef))`};
}
