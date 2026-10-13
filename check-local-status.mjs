import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const paths = ['C:/Users/tetiana.flora/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe', 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'];
const docker = paths.find(p => fs.existsSync(p));
console.log('Docker CLI:', docker || 'not found');
if (docker) for (const args of [['info', '--format', '{{.ServerVersion}}'], ['compose', '-p', 'vsmarket-local', '-f', 'saleor-platform/docker-compose.yml', 'ps'], ['volume', 'ls', '--filter', 'name=vsmarket-local']]) {
  const r = spawnSync(docker, args, {encoding:'utf8', windowsHide:true, timeout:20000});
  console.log(args.join(' '), r.status, r.stdout, r.stderr, r.error?.message || '');
}
for (const [name,url] of [['storefront','http://127.0.0.1:8790/api/catalog'], ['saleor','http://127.0.0.1:8000/graphql/']]) {
  try { const r=await fetch(url, {signal:AbortSignal.timeout(3000)}); console.log(name,r.status); if(name==='storefront') { const body=await r.json(); console.log('Catalog:', body.error || `${body.products?.length} products`); } } catch(e) { console.log(name,e.message); }
}
console.log('Configured local env:',fs.existsSync('.env'));
