from pathlib import Path
import re,json,xml.etree.ElementTree as ET,sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path('C:/Проекти/Конфигурация базы 1С vsmarket')
raw=Path('C:/Users/tetiana.flora/DBNames_decoded.txt').read_text(encoding='utf-8-sig')
mapping={}
for uid,kind,num in re.findall(r'\{([0-9a-f-]{36}),"([^"]+)",(\d+)\}',raw,re.I):mapping.setdefault(uid.lower(),[]).append((kind,num))
prefixes=['Catalog.НоменклатураПрисоединенныеФайлы','Catalog.ХарактеристикиНоменклатурыПрисоединенныеФайлы']
for el in ET.parse(root/'ConfigDumpInfo.xml').iter():
    name=el.attrib.get('name','')
    if any(name==p or name.startswith(p+'.Attribute.') for p in prefixes) or ('Файл' in name and name.startswith('InformationRegister.') and name.count('.')<=3):
        matches=mapping.get(el.attrib.get('id','').lower(),[])
        if matches: print(json.dumps({'name':name,'sql':matches},ensure_ascii=False))
for name in ['НоменклатураПрисоединенныеФайлы','ХарактеристикиНоменклатурыПрисоединенныеФайлы','Номенклатура']:
    path=root/'Catalogs'/f'{name}.xml'
    if not path.exists():continue
    for el in ET.parse(path).iter():
        if el.tag.split('}')[-1]=='Attribute':
            props=next((x for x in el if x.tag.split('}')[-1]=='Properties'),None)
            if props is not None:
                values={x.tag.split('}')[-1]:''.join(x.itertext()).strip() for x in props if x.tag.split('}')[-1] in ['Name','Type','Synonym']}
                if name!='Номенклатура' or values.get('Name') in ['Ширина','Высота','Описание','НаименованиеПолное','ФайлКартинки']:print(name,json.dumps(values,ensure_ascii=False))
    modules=list((root/'Catalogs'/name).rglob('*.bsl'))
    for module in modules:
        lines=module.read_text(encoding='utf-8-sig').splitlines()
        matches=[i for i,line in enumerate(lines) if ('Хранение' in line or 'ДанныеФайла' in line or 'мм' in line or 'Ширина' in line or 'Высота' in line)]
        if name=='Номенклатура':modules=[];break
        for i in matches[:6]:
            print(str(module.relative_to(root)), '\n'.join(f'{j+1}: {lines[j]}' for j in range(max(0,i-3),min(len(lines),i+6))))
