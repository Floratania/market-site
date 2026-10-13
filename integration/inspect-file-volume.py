exec(open('integration/inspect-product-media-metadata.py',encoding='utf-8').read().split('prefixes=')[0])
prefixes=['Catalog.ТомаХраненияФайлов','Enum.ТипыХраненияФайлов']
for el in ET.parse(root/'ConfigDumpInfo.xml').iter():
 name=el.attrib.get('name','')
 if any(name==p or name.startswith(p+'.Attribute.') or name.startswith(p+'.EnumValue.') for p in prefixes):
  print(json.dumps({'name':name,'sql':mapping.get(el.attrib.get('id','').lower(),[])},ensure_ascii=False))
for name in ['ТомаХраненияФайлов']:
 path=root/'Catalogs'/f'{name}.xml'
 for el in ET.parse(path).iter():
  if el.tag.split('}')[-1]=='Attribute':
   props=next((x for x in el if x.tag.split('}')[-1]=='Properties'),None)
   if props is not None:print(json.dumps({x.tag.split('}')[-1]:''.join(x.itertext()).strip() for x in props if x.tag.split('}')[-1] in ['Name','Type','Synonym']},ensure_ascii=False))
