from pathlib import Path
import xml.etree.ElementTree as ET
import json
root=Path('C:/Проекти/Конфигурация базы 1С vsmarket')
out=Path(__file__).parent/'integration'
mapping={row['name']:row for row in json.loads((out/'storage-map.json').read_text(encoding='utf-8-sig'))}
public={'Артикул':'article','НаименованиеПолное':'name','НаименованиеДляПечати':'variantName','Комментарий':'description','КатегорияНоменклатуры':'category','ЕдиницаИзмерения':'unit','Производитель':'manufacturer','СтранаПроисхождения':'country','Вес':'weight','Ширина':'width','Высота':'height','Длина':'length','ГарантийныйСрок':'warranty','Цвет':'color','Профиль':'profile','Тип':'product_type','ФайлКартинки':'image'}
control={'Недействителен','ДатаИзменения','ДатаОкончанияДействия','ТипНоменклатуры','ИспользоватьХарактеристики','ИсключитьИзПрайсЛистов','ЭтоНабор','ЭтоНовинка','СрокДействияФлагаНовинка','СрокИсполненияЗаказа','Склад','Ячейка'}
rows=[]
local=lambda element:element.tag.split('}')[-1]
def child(e,name):return next((x for x in e if local(x)==name),None)
def text(e):return ' '.join(s.strip() for s in e.itertext() if s.strip()) if e is not None else ''
def label(props):
 syn=child(props,'Synonym')
 if syn is not None:
  for item in syn.iter():
   if local(item)=='item' and text(child(item,'lang'))=='uk':return text(child(item,'content'))
 return text(child(props,'Name'))
def record(obj,section,e):
 p=child(e,'Properties');name=text(child(p,'Name'))
 full=f'Catalog.{obj}.'+(f'TabularSection.{section}.' if section else '')+'Attribute.'+name
 dest='Додаткові публічні характеристики після розшифрування та явного дозволу' if section=='ДополнительныеРеквизиты' else ('Публічне поле: '+public[name] if not section and name in public else 'Правила інтеграції; не публічне поле' if not section and name in control else 'Внутрішнє поле; перевірити потребу адаптера')
 rows.append({'source':full,'label':label(p),'type':text(child(p,'Type')),'physicalTokens':mapping.get(full,{}).get('sql',[]),'destination':dest,'liveViewColumn':None})
for obj in ['Номенклатура','ХарактеристикиНоменклатуры']:
 catalog=next(e for e in ET.parse(root/'Catalogs'/f'{obj}.xml').getroot() if local(e)=='Catalog')
 for e in child(catalog,'ChildObjects'):
  if local(e)=='Attribute':record(obj,'',e)
  elif local(e)=='TabularSection':
   section=text(child(child(e,'Properties'),'Name'))
   for attr in child(e,'ChildObjects'):
    if local(attr)=='Attribute':record(obj,section,attr)
(out/'catalog-fields.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
md=['# Повний перелік реквізитів каталогу VS Market','',f'З XML конфігурації отримано **{len(rows)} реквізитів**, включно з полями табличних частин. Це опис експорту, а не результат читання живих views.','',
'Стандартні поля 1С Ссылка, Код, Наименование, Родитель, ЭтоГруппа, ПометкаУдаления та власник характеристики враховуються окремо: ключі, ієрархія, назва й виключення з публікації. Артикул не є гарантовано унікальним SKU.','',
'Таблиці з `_Reference…` існують у фізичному сховищі 1С; семантичні об’єкти `vsmarket_bi` можуть бути views. Їхні назви колонок і повнота ще не звірені. `_Fld…` нижче — токен DBNames, не готове ім’я колонки: можливі суфікси RRef/TYPE/RRRef та інші.','',
'Публічне поле у таблиці — заплановане зіставлення для імпортера. На сайті підготовлено показ `specifications`, але імпорт із BI ще не працює. Невідомі значення не підставляються.','',
'Колір, профіль, тип, ширина та висота присутні саме в довіднику характеристик. Варіант Saleor відповідає парі номенклатура + характеристика. Дані характеристики мають перевагу над загальними параметрами товару, якщо заповнені.','',
'Для розмірів одиниці потрібно підтвердити: у номенклатурі синонім містить «см3», а у характеристиках одиницю не зазначено. Для гарантійного строку одиниця також потребує підтвердження. Вага у синонімі визначена як кг. Поле Изготовитель посилається на структурну одиницю, тому його не можна автоматично підміняти назвою бренду з Производитель.','',
'Додаткові реквізити читаються в обох довідниках. Назва — з плану властивостей; посилальне значення — з відповідного довідника. Публікація і використання у фільтрі задаються окремо за ідентифікатором властивості. Склад у картці номенклатури не означає фактичний залишок на цьому складі.','',
'| Джерело | Українська назва | Тип | Токени DBNames | Призначення |','|---|---|---|---|---|']
for row in rows:
 tokens=', '.join('_'+p+n for p,n in row['physicalTokens']) or 'не зіставлено'
 md.append('| '+' | '.join(str(v).replace('|','\\|') for v in [row['source'],row['label'],row['type'],tokens,row['destination']])+' |')
(out/'catalog-fields.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(f'Generated {len(rows)} field mappings; live columns remain unverified.')
