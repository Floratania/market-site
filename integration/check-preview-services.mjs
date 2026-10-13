import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const docker=`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`;
if(!fs.existsSync(docker))throw new Error('Docker CLI unavailable');
const args=process.argv.includes('--inventory')?['ps','-a','--format','{{.Names}}\t{{.Status}}']:process.argv.includes('--engine')?['desktop','start','--timeout','45']:['compose','-p','vsmarket-local','-f','docker-compose.yml',...(process.argv.includes('--start')?['start','db','cache','api']:['ps','--all','--format','json'])];
const result=spawnSync(docker,args,{cwd:new URL('../saleor-platform/',import.meta.url),encoding:'utf8',windowsHide:true});
console.log(result.stdout);console.error(result.stderr);if(result.error)console.error(result.error.message);process.exitCode=result.status??1;
