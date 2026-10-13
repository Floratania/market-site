import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile(new URL('bi-schema.local.json',import.meta.url),'utf8'));
console.log('Record sets',data.resultSets.map(rows=>rows.length));
const objects=new Map();
for(const row of data.resultSets[0]){
 const name=`${row.SchemaName}.${row.ObjectName}`;
 if(!objects.has(name))objects.set(name,{type:row.type_desc,columns:[]});
 objects.get(name).columns.push(row.ColumnName);
}
for(const [name,item] of objects)if(/^(dbo\.(Справочники\.(Номенклатура|ХарактеристикиНоменклатуры|СтруктурныеЕдиницы|ЗначенияСвойствОбъектов)$|РегистрыСведений\.ОстаткиТоваров$|РегистрыНакопления\.ЗапасыНаСкладах\.Остатки))/.test(name))console.log(name,item.type,JSON.stringify(item.columns));
console.log('Source databases', [...new Set(data.resultSets[2].map(row=>row.referenced_database_name))]);
console.log('Warehouses',data.resultSets[4]);
console.log('Product group',data.resultSets[5]);
for(const row of data.resultSets[1])if(/ОстаткиТоваров|ХарактеристикиНоменклатуры|Номенклатура\.Дополнительные|Номенклатура$/.test(row.ViewName))console.log('VIEW',row.ViewName,row.ViewDefinition);
