import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mailDir = path.join(root, '.runtime', 'mail');
await fs.mkdir(mailDir, { recursive: true });
await fs.writeFile(path.join(mailDir, 'package.json'), JSON.stringify({ private: true, name: 'vsmarket-mail-runtime', version: '1.0.0' }));
const pnpm = path.resolve(path.dirname(process.execPath), '../node_modules/pnpm/bin/pnpm.cjs');
const metadata = await (await fetch('https://registry.npmjs.org/nodemailer/latest')).json();
if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) throw new Error('Invalid registry metadata');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [pnpm, 'add', `nodemailer@${metadata.version}`, '--ignore-scripts'], {cwd:mailDir,stdio:'inherit',windowsHide:true});
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`pnpm exit ${code}`)));
});
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
pkg.dependencies.nodemailer = metadata.version;
await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
try {
  const lockPath = path.join(root, 'package-lock.json');
  const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
  lock.packages[''].dependencies.nodemailer = metadata.version;
  lock.packages['node_modules/nodemailer'] = {version:metadata.version,resolved:metadata.dist.tarball,integrity:metadata.dist.integrity,license:metadata.license,engines:metadata.engines};
  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
} catch (error) { if(error.code !== 'ENOENT') throw error; }
console.log(`Mail dependency ready: nodemailer ${metadata.version}`);
