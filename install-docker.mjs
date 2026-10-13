import { spawn } from 'node:child_process';
const child = spawn('winget.exe', ['install', '--id', 'Docker.DockerDesktop', '--exact', '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity', '--override', 'install --user --quiet'], { stdio: 'inherit' });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code || 0; });
