import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const candidates=[`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`,'C:/Users/tetiana.flora/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe','C:/Program Files/Docker/Docker/resources/bin/docker.exe'];
const docker=candidates.find(p=>fs.existsSync(p));
if(!docker)throw new Error('Docker not found');
const code=process.argv.includes('--inspect') ? "from saleor.channel.models import Channel; print([(f.name, f.has_default()) for f in Channel._meta.fields]); print(list(Channel.objects.values('slug','currency_code','default_country','is_active')))" : "from saleor.channel.models import Channel; c,created=Channel.objects.get_or_create(slug='vs-market-ua',defaults={'name':'VS Market Ukraine','currency_code':'UAH','default_country':'UA','is_active':True}); print({'slug':c.slug,'currency':c.currency_code,'active':c.is_active,'created':created})";
const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',code],{stdio:'inherit',windowsHide:true,env:{...process.env,PATH:`${path.dirname(docker)}${path.delimiter}${process.env.PATH||''}`}});
child.on('error',e=>{console.error(e.message);process.exitCode=1});child.on('exit',code=>{process.exitCode=code||0});
