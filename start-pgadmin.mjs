import { spawn } from 'node:child_process';
await import('./configure-pgadmin.mjs');
const child=spawn(process.execPath,['docker-command.mjs','compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','up','-d','pgadmin'],{cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true});
child.on('exit',code=>process.exitCode=code||0);
child.on('error',error=>{console.error(error.message);process.exitCode=1});
