import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const file=process.argv[2];
if(!file||!/^integration\/[a-z0-9-]+\.py$/.test(file))throw new Error('Use a local integration Python script');
const script=await fs.readFile(new URL(`../${file}`,import.meta.url),'utf8');
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{
 stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
child.on('error',()=>{console.error('Local Docker Python unavailable');process.exitCode=1});
child.on('exit',code=>{process.exitCode=code||0});
