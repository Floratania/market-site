import fs from 'node:fs/promises';import {spawn} from 'node:child_process';
const script=await fs.readFile(new URL('verify-website-commerce-db.py',import.meta.url),'utf8'),module=await fs.readFile(new URL('website-commerce.py',import.meta.url),'utf8');
const child=spawn('docker',['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','-c',script],{cwd:new URL('../',import.meta.url),windowsHide:true,stdio:['pipe','pipe','pipe']});
let output='',errors='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);child.stdin.end(JSON.stringify({script:module}));child.on('exit',code=>{console.log(output);if(code){console.error(errors);process.exitCode=code;}});
