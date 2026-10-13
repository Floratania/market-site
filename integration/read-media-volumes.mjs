import fs from 'node:fs/promises';
import {biPool} from './bi-read.mjs';
const media=JSON.parse(await fs.readFile(new URL('product-media-source.local.json',import.meta.url),'utf8'));
const pool=await biPool();
try{
 const result=await pool.request().query(`SELECT CONVERT(varchar(34),_IDRRef,1) VolumeRef,_Description Name,_Fld16231 LinuxPath,_Fld16232 WindowsPath FROM [vsmarket].dbo._Reference261 WHERE _Marked=0x00;`);
 const used=result.recordset.filter(v=>media.files.some(f=>f.VolumeRef===v.VolumeRef));
 await fs.writeFile(new URL('product-media-volumes.local.json',import.meta.url),JSON.stringify(used,null,2));console.log(JSON.stringify(used,null,2));
}finally{await pool.close();}
