import path from 'node:path';
import { spawn } from 'node:child_process';
const docker=`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`;
const script=`from pathlib import Path
for file in ['saleor/settings.py','saleor/product/models.py','saleor/core/db/locks.py']:
 p=Path('/app')/file
 if p.exists():
  print('FILE',file)
  for i,line in enumerate(p.read_text().splitlines(),1):
   if any(term in line for term in ['django.contrib.postgres','postgres://','SearchVectorField','GinIndex','ArrayField','pg_advisory','PostgreSQL']):print(str(i)+': '+line.strip())
`;
const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','-c',script],{cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
child.on('exit',code=>process.exitCode=code||0);
child.on('error',error=>{console.error(error.message);process.exitCode=1});
