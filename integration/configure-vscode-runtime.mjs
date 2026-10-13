import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtimeDir = path.join(root, '.runtime', 'node');
const target = path.join(runtimeDir, 'node.exe');
await fs.mkdir(runtimeDir, { recursive: true });
if (path.resolve(process.execPath) !== path.resolve(target)) {
  await fs.copyFile(process.execPath, target);
}
const readJson = async (name, fallback = {}) => {
  try { return JSON.parse(await fs.readFile(path.join(root, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
const saveJson = (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
const settings = await readJson('.vscode/settings.json');
settings['terminal.integrated.env.windows'] = {
  ...settings['terminal.integrated.env.windows'],
  PATH: '${workspaceFolder}\\.runtime\\node;${env:PATH}',
};
await saveJson('.vscode/settings.json', settings);
const launch = await readJson('.vscode/launch.json');
for (const config of launch.configurations || []) {
  if (config.type === 'node') config.runtimeExecutable = '${workspaceFolder}/.runtime/node/node.exe';
}
await saveJson('.vscode/launch.json', launch);
const tasks = await readJson('.vscode/tasks.json');
for (const task of tasks.tasks || []) {
  if (task.command === 'node') task.command = '${workspaceFolder}/.runtime/node/node.exe';
}
await saveJson('.vscode/tasks.json', tasks);
console.log(`VS Code runtime ready: ${target}`);
console.log(`Node.js ${process.version}`);
