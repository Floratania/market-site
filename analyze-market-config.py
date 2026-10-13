from pathlib import Path
import xml.etree.ElementTree as ET
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path('C:/Проекти/Конфигурация базы 1С vsmarket')
paths=sys.argv[1:] or ['AccumulationRegisters/ЗапасыНаСкладах.xml','AccumulationRegisters/ЗапасыКРасходуСоСкладов.xml','AccumulationRegisters/РезервыТоваровОрганизаций.xml','Catalogs/Номенклатура.xml','Catalogs/СтруктурныеЕдиницы.xml']
def tag(x): return x.tag.split('}')[-1]
def props(x):
 p=next((y for y in x if tag(y)=='Properties'),None)
 if p is None:return {}
 return {tag(y):' '.join(t.strip() for t in y.itertext() if t.strip()) for y in p if tag(y) in ['Name','Type','RegisterType','Hierarchical','HierarchyType','UseTotals','Periodicity','Use','Synonym']}
for name in paths:
 name,_,span=name.partition('@')
 p=root/name
 print('\nFILE',str(p))
 if p.suffix=='.xml':
  doc=ET.parse(p).getroot()
  for x in doc:
   if tag(x)=='InternalInfo': continue
   print(json.dumps({'kind':tag(x),'properties':props(x)},ensure_ascii=False))
   ch=next((y for y in x if tag(y)=='ChildObjects'),None)
   if ch is not None:
    for y in ch:
     if tag(y) in ['Dimension','Resource','Attribute','TabularSection']:
      print(json.dumps({'kind':tag(y),'properties':props(y)},ensure_ascii=False))
      c=next((z for z in y if tag(z)=='ChildObjects'),None)
      if c is not None:
       for z in c: print(json.dumps({'section':props(y).get('Name'),'kind':tag(z),'properties':props(z)},ensure_ascii=False))
 else:
  lines=p.read_text(encoding='utf-8-sig').splitlines()
  if span:
   start,end=map(int,span.split(':'));chosen=range(start-1,min(end,len(lines)))
  elif len(lines)<240: chosen=range(len(lines))
  else:
   terms=['ЗапасыНаСкладах','ЗапасыКРасходуСоСкладов','РезервыТоваровОрганизаций','СвободныйОстаток','Резерв','КоличествоОстаток','Свойства','Ширина','Высота']
   chosen=sorted({j for i,l in enumerate(lines) if any(t in l for t in terms) for j in range(max(0,i-3),min(len(lines),i+13))})
  for i in chosen:print(f'{i+1}: {lines[i]}')
