from pathlib import Path
import re,json,xml.etree.ElementTree as ET,sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path('C:/Проекти/Конфигурация базы 1С vsmarket')
raw=Path('C:/Users/tetiana.flora/DBNames_decoded.txt').read_text(encoding='utf-8-sig')
mapping={}
for uid,kind,num in re.findall(r'\{([0-9a-f-]{36}),"([^"]+)",(\d+)\}',raw,re.I): mapping.setdefault(uid.lower(),[]).append((kind,num))
tree=ET.parse(root/'ConfigDumpInfo.xml')
prefixes=['Catalog.Номенклатура','Catalog.СтруктурныеЕдиницы','Catalog.ХарактеристикиНоменклатуры','InformationRegister.ОстаткиТоваров','AccumulationRegister.ЗапасыНаСкладах','AccumulationRegister.Запасы','AccumulationRegister.РезервыТоваровОрганизаций','AccumulationRegister.ЗапасыКРасходуСоСкладов']
prefixes += ['ChartOfCharacteristicTypes.ДополнительныеРеквизитыИСведения','Catalog.ЗначенияСвойствОбъектов']
records=[]
for x in tree.iter():
 name=x.attrib.get('name','');uid=x.attrib.get('id','')
 if any(name==p or name.startswith(p+'.Dimension.') or name.startswith(p+'.Resource.') or name.startswith(p+'.Attribute.') or (p.startswith('Catalog.') and name.startswith(p+'.TabularSection.')) for p in prefixes):
  matches=mapping.get(uid.lower(),[])
  if matches: records.append({'name':name,'uuid':uid,'sql':matches})
Path('integration').mkdir(exist_ok=True)
Path('integration/storage-map.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
for r in records:
 name=r['name']
 if name.count('.')==1 or name.startswith('InformationRegister.ОстаткиТоваров.') or '.TabularSection.' in name or name.endswith(('.Артикул','.Высота','.Ширина','.ЕдиницаИзмерения')):
  print(json.dumps(r,ensure_ascii=False))
for x in tree.iter():
 matches=mapping.get(x.attrib.get('id','').lower(),[])
 if ('Reference','108') in matches: print('REFERENCE108',x.attrib.get('name'),matches)
