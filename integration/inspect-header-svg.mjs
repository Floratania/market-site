import {readFile} from 'node:fs/promises';
const file='C:/Users/tetiana.flora/.codex/attachments/6c06f085-5081-45bc-b1d2-6a805724c323/Вставлений текст.txt';
const source=await readFile(file,'utf8');
console.log(JSON.stringify({length:source.length,start:source.slice(0,1400),end:source.slice(-250),activeTags:source.match(/<(?:script|foreignObject|iframe)\b/gi),hrefs:[...source.matchAll(/(?:xlink:)?href=["']([^"']+)/g)].map(match=>match[1].slice(0,100))},null,2));
