import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
const paths = [`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`, 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'];
const docker = paths.find((file) => fs.existsSync(file)) || 'docker';
const child = spawn(docker, process.argv.slice(2), { stdio: 'inherit', windowsHide: true, env: { ...process.env, PATH: `${path.dirname(docker)}${path.delimiter}${process.env.PATH || ''}` } });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code || 0; });
