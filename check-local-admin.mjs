import path from 'node:path';
import {spawn} from 'node:child_process';
for (const [name, url] of [['Saleor Dashboard','http://127.0.0.1:9000/'],['pgAdmin','http://127.0.0.1:5050/login'],['Storefront','http://127.0.0.1:8790/?demo=1']]) {
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    console.log(`${name}: HTTP ${response.status}`);
  } catch {console.log(`${name}: unavailable`);}
}
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const script="from saleor.account.models import User; print('Active staff accounts:', User.objects.filter(is_staff=True,is_active=True).count()); print('Superuser accounts:',User.objects.filter(is_superuser=True,is_active=True).count())";
const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
child.on('exit',code=>process.exitCode=code||0);
child.on('error',()=>{console.error('Local account inspection failed');process.exitCode=1;});
