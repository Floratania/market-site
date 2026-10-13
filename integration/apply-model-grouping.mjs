import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const base=new URL('./',import.meta.url),groups=JSON.parse(await fs.readFile(new URL('model-groups.local.json',base),'utf8'));
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe'),args=['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml'];
const options={windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}};
await fs.mkdir(new URL('backups/',base),{recursive:true});
const backup=new URL(`backups/saleor-before-grouping-${Date.now()}.dump`,base),file=await fs.open(backup,'wx');
try{await new Promise((resolve,reject)=>{const child=spawn(docker,[...args,'exec','-T','db','pg_dump','-U','saleor','-d','saleor','--format=custom'],{...options,stdio:['ignore',file.fd,'pipe']});let errors='';child.stderr.on('data',data=>errors+=data);child.on('error',reject);child.on('exit',code=>code?reject(new Error('Local database backup failed: '+errors)):resolve());});}finally{await file.close();}
console.log('Local database backup saved');
const script=await fs.readFile(new URL('group-saleor-models.py',base),'utf8');
let output='';await new Promise((resolve,reject)=>{const child=spawn(docker,[...args,'exec','-T','api','python3','manage.py','shell','-c',script],{...options,stdio:['pipe','pipe','pipe']});child.stdin.end(JSON.stringify({...groups,availableAt:new Date().toISOString()}));child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>process.stderr.write(data));child.on('error',reject);child.on('exit',code=>code?reject(new Error('Atomic model grouping failed: '+output.slice(-2000))):resolve());});
const line=output.split('\n').find(line=>line.startsWith('GROUP_RESULT:'));if(!line)throw new Error('Missing grouping result');
const result=JSON.parse(line.slice('GROUP_RESULT:'.length));
await fs.writeFile(new URL('model-product-aliases.json',base),JSON.stringify(result.aliases,null,2));
await fs.writeFile(new URL('saleor-model-grouping.local.json',base),JSON.stringify({appliedAt:new Date().toISOString(),backup:backup.href,...result},null,2));
console.log(JSON.stringify({models:result.models.length,variants:result.aliases.length},null,2));
