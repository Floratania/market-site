import fs from 'node:fs';
import { spawn } from 'node:child_process';
const executable='C:/Users/tetiana.flora/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe';
if(!fs.existsSync(executable)) throw new Error('Docker Desktop executable missing');
const child=spawn(executable,[],{detached:true,stdio:'ignore',windowsHide:true});
child.on('error',e=>console.error(e.message)); child.unref();
console.log('Docker Desktop launched. Any agreement must be accepted by the user.');
