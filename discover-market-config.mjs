import fs from 'node:fs';
for(const p of ['C:/','C:/Проекти','C:/Users/tetiana.flora/source','C:/Users/tetiana.flora/Documents']) {
 try { console.log(p); console.log(fs.readdirSync(p,{withFileTypes:true}).filter(x=>x.isDirectory()||/AGENTS|\.cf$|\.dt$|Configuration\.xml/i.test(x.name)).map(x=>`${x.isDirectory()?'DIR':'FILE'} ${x.name}`).join('\n')); } catch(e){console.log(e.code);}
}
const attachment='C:/Users/tetiana.flora/.codex/attachments/18c3467c-ac3f-47ca-9c58-3058db4b64d6/Вставлений текст.txt';
try { console.log('ATTACHED TEXT'); console.log(fs.readFileSync(attachment,'utf8').slice(0,15000)); }catch(e){console.log(e.code);}
