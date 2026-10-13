import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const docker=`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`;
const script=`from pathlib import Path
import json,importlib.metadata
terms=['django.contrib.postgres','SearchVector','SearchRank','GinIndex','ArrayField','pg_advisory','DISTINCT ON','jsonb','::json','::tsvector','Trigram','ExclusionConstraint']
result={term:[] for term in terms}
for file in Path('/app/saleor').rglob('*.py'):
 text=file.read_text()
 for term in terms:
  if term in text:result[term].append(str(file.relative_to('/app')))
print(json.dumps({'django':importlib.metadata.version('Django'),'psycopg':importlib.metadata.version('psycopg'),'dependencies':result},ensure_ascii=False))
`;
const output=await new Promise((resolve,reject)=>{
 const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','-c',script],{cwd:new URL('./',import.meta.url),stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
 let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.on('error',reject);child.on('exit',code=>code===0 ? resolve(stdout) : reject(new Error(stderr.slice(0,500))));
});
const result=JSON.parse(output);
await fs.writeFile(new URL('integration/saleor-mssql-audit.json',import.meta.url),JSON.stringify(result,null,2));
console.log('Django',result.django,'psycopg',result.psycopg);
for(const [term,files] of Object.entries(result.dependencies))console.log(term,files.length,files.slice(0,4));
