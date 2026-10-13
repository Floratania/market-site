import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.LOCALAPPDATA;
for (const file of [`${base}/Programs/DockerDesktop/Docker Desktop.exe`, `${base}/Programs/DockerDesktop/resources/bin/docker.exe`, 'C:/Program Files/Docker/Docker/Docker Desktop.exe', 'C:/Program Files/Docker/Docker/resources/bin/docker.exe']) console.log(`${fs.existsSync(file) ? 'FOUND' : 'missing'} ${file}`);
const processes = execFileSync('tasklist.exe', ['/fo', 'csv', '/nh'], { encoding: 'utf8' });
console.log(processes.split('\n').filter((line) => /docker|winget|consent/i.test(line)).join('\n'));
for (const file of [`${base}/Docker/install-log.txt`, `${base}/Docker/install-log-admin.txt`, `${base}/DockerDesktop/install-log.txt`]) {
  if (fs.existsSync(file)) {
    console.log('Installer log:', file);
    console.log(fs.readFileSync(file, 'utf8').split('\n').slice(-16).join('\n'));
  }
}
const backendLog = `${base}/Docker/log/host/com.docker.backend.exe.log`;
if (fs.existsSync(backendLog)) console.log(fs.readFileSync(backendLog, 'utf8').split('\n').filter((line) => /error|license|terms|wsl|failed|virtualiz/i.test(line) && !/\.idle|event streamer|analytics|UsageMetrics|idle\./i.test(line)).slice(-20).join('\n'));
