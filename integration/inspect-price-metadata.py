from pathlib import Path
import json, re, xml.etree.ElementTree as ET
import sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path('C:/Проекти/Конфигурация базы 1С vsmarket')
raw=Path('C:/Users/tetiana.flora/DBNames_decoded.txt').read_text(encoding='utf-8-sig')
mapping={}
for uid,kind,num in re.findall(r'\{([0-9a-f-]{36}),"([^"]+)",(\d+)\}',raw,re.I):
    mapping.setdefault(uid.lower(),[]).append((kind,num))
tree=ET.parse(root/'ConfigDumpInfo.xml')
for el in tree.iter():
    name=el.attrib.get('name','')
    if name.startswith(('InformationRegister.ЦеныНоменклатуры.', 'Catalog.ВидыЦен.', 'Catalog.Валюты.')) or name in ['InformationRegister.ЦеныНоменклатуры','Catalog.ВидыЦен','Catalog.Валюты']:
        matches=mapping.get(el.attrib.get('id','').lower(),[])
        if matches: print(json.dumps({'name':name,'sql':matches},ensure_ascii=False))
for name in ['ВидыЦен','Валюты']:
    path=root/'Catalogs'/f'{name}.xml'
    if path.exists():
        doc=ET.parse(path)
        for el in doc.iter():
            if el.tag.split('}')[-1]=='Attribute':
                props=next((x for x in el if x.tag.split('}')[-1]=='Properties'),None)
                if props is not None:
                    fields={x.tag.split('}')[-1]:''.join(x.itertext()).strip() for x in props if x.tag.split('}')[-1] in ['Name','Type']}
                    print(name,json.dumps(fields,ensure_ascii=False))
module=root/'Catalogs/Номенклатура/Forms/ФормаСписка/Ext/Form/Module.bsl'
lines=module.read_text(encoding='utf-8-sig').splitlines()
for start,end in [(8063,8105),(8210,8280)]:
    print('\n'.join(f'{j+1}: {lines[j]}' for j in range(start-1,min(len(lines),end))))
schema=json.loads(Path('integration/bi-schema.local.json').read_text(encoding='utf-8-sig'))
for rows in schema['resultSets']:
    for row in rows:
        if row.get('ViewName') in ['Справочники.ВидыЦен','Справочники.Валюты','Справочники.ЕдиницыИзмерения','Справочники.КлассификаторЕдиницИзмерения'] and 'ViewDefinition' in row:
            print(json.dumps(row,ensure_ascii=False))
