import fs from 'node:fs';
for(const name of ['DBNames_decoded.txt','db_structure.txt']) {
 const p=`C:/Users/tetiana.flora/${name}`;
 if(!fs.existsSync(p))continue;
 const text=fs.readFileSync(p,'utf8'); console.log(name,'length',text.length,'start',text.slice(0,400));
 console.log(text.split('\n').filter(l=>/14135|14136|14036|Reference159|ЗапасыНаСкладах|ЗапасыКРасходу|Номенклатура|ДополнительныеРеквизиты/.test(l)).slice(0,30).join('\n'));
}
