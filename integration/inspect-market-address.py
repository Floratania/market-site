from pathlib import Path
import json, re, xml.etree.ElementTree as ET,sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path('C:/Проекти/Конфигурация базы 1С vsmarket')
doc=ET.parse(root/'Catalogs/СтруктурныеЕдиницы.xml')
for el in doc.iter():
    if el.tag.split('}')[-1] in ['Attribute','TabularSection']:
        props=next((x for x in el if x.tag.split('}')[-1]=='Properties'),None)
        if props is not None:
            print(json.dumps({x.tag.split('}')[-1]:''.join(x.itertext()).strip() for x in props if x.tag.split('}')[-1] in ['Name','Type']},ensure_ascii=False))
mapping={}
raw=Path('C:/Users/tetiana.flora/DBNames_decoded.txt').read_text(encoding='utf-8-sig')
for uid,kind,num in re.findall(r'\{([0-9a-f-]{36}),"([^"]+)",(\d+)\}',raw,re.I):mapping.setdefault(uid.lower(),[]).append((kind,num))
for el in ET.parse(root/'ConfigDumpInfo.xml').iter():
    name=el.attrib.get('name','')
    if name.startswith('Catalog.СтруктурныеЕдиницы') or ('КонтактнаяИнформация' in name and name.startswith('InformationRegister')):
        matches=mapping.get(el.attrib.get('id','').lower(),[])
        if matches: print(json.dumps({'name':name,'sql':matches},ensure_ascii=False))
