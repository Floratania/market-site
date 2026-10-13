import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile(new URL('source-discovery.local.json',import.meta.url),'utf8'));
const objects=new Map();
for(const row of data.resultSets[0]){ if(!objects.has(row.ObjectName))objects.set(row.ObjectName,[]); objects.get(row.ObjectName).push(row.ColumnName); }
for(const [name,columns] of objects)console.log(name,columns.join(', '));
console.log('Group and children',data.resultSets.slice(1));
const map=JSON.parse(await fs.readFile(new URL('storage-map.json',import.meta.url),'utf8'));
for(const row of map)if(/^Catalog\.(Номенклатура|ХарактеристикиНоменклатуры)\.(Attribute\.(Артикул|Ширина|Высота|Цвет|Профиль|Тип|Недействителен|Комментарий|Производитель|СтранаПроисхождения|ЕдиницаИзмерения)|TabularSection\.ДополнительныеРеквизиты)/.test(row.name))console.log(row.name,row.sql);
