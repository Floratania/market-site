import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const base=new URL('./',import.meta.url);
const media=JSON.parse(await fs.readFile(new URL('product-media-source.local.json',base),'utf8'));
const volumes=JSON.parse(await fs.readFile(new URL('product-media-volumes.local.json',base),'utf8'));
const folder=new URL('product-photos/',base);await fs.mkdir(folder,{recursive:true});
const photos=[],issues=[];
const unavailableVolumes=new Map();
for(const volume of volumes){try{await fs.access(volume.WindowsPath);}catch(error){unavailableVolumes.set(volume.VolumeRef,error.code||'unavailable-volume');}}
function mimeFor(bytes){
 if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return ['image/jpeg','jpg'];
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['image/png','png'];
 if(/^GIF8[79]a$/.test(bytes.subarray(0,6).toString('ascii')))return ['image/gif','gif'];
 return null;
}
for(const file of media.files){
 if(!['jpg','jpeg','png','gif'].includes(file.Extension?.toLowerCase())||file.Encrypted)continue;
 const volume=volumes.find(v=>v.VolumeRef===file.VolumeRef);
 if(!volume?.WindowsPath){issues.push({fileRef:file.FileRef,reason:'missing-volume'});continue;}
 if(unavailableVolumes.has(file.VolumeRef)){issues.push({productRef:file.ProductRef,fileRef:file.FileRef,reason:unavailableVolumes.get(file.VolumeRef)});continue;}
 const root=path.win32.resolve(volume.WindowsPath),source=path.win32.resolve(root,file.FilePath);
 if(!source.toLowerCase().startsWith(root.toLowerCase().replace(/\\?$/,'\\'))){issues.push({fileRef:file.FileRef,reason:'unsafe-path'});continue;}
 try{
  const info=await fs.stat(source);if(!info.isFile()||info.size>25*1024*1024||info.size!==Number(file.DeclaredSize))throw new Error('size-mismatch');
  const bytes=await fs.readFile(source),format=mimeFor(bytes);if(!format)throw new Error('unsupported-image');
  const digest=crypto.createHash('sha256').update(bytes).digest('hex'),name=`${digest}.${format[1]}`;
  await fs.writeFile(new URL(name,folder),bytes);
  photos.push({productRef:file.ProductRef,fileRef:file.FileRef,isMain:!!file.IsMain,title:file.FileName,path:`product-photos/${name}`,sha256:digest,mime:format[0],size:bytes.length});
 }catch(error){issues.push({productRef:file.ProductRef,fileRef:file.FileRef,reason:error.code||error.message});}
}
const report={checkedAt:new Date().toISOString(),photos,issues};
await fs.writeFile(new URL('product-photos-manifest.local.json',base),JSON.stringify(report,null,2));
console.log(JSON.stringify({photos:photos.length,products:new Set(photos.map(p=>p.productRef)).size,uniqueFiles:new Set(photos.map(p=>p.sha256)).size,issues:issues.length,reasons:[...new Set(issues.map(i=>i.reason))]},null,2));
