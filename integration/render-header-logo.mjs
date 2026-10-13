import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1007-641-0_26.1007.641.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/runtime.js');
const sharp=require('sharp');
const svg=await fs.readFile(new URL('../public/assets/icons/brand-logo-transparent.svg',import.meta.url));
await sharp({create:{width:810,height:190,channels:4,background:'#101213'}}).composite([{input:await sharp(svg).resize(730,110).png().toBuffer(),top:40,left:40}]).png().toFile(fileURLToPath(new URL('header-logo-dark-check.png',import.meta.url)));
console.log('Rendered transparent SVG on dark header background.');
