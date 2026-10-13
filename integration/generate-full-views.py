"""Generate reviewable views from verified live columns and exported 1C metadata."""
from pathlib import Path
import json
from collections import defaultdict

base = Path(__file__).parent
fields = json.loads((base / 'catalog-fields.json').read_text(encoding='utf-8-sig'))
source = json.loads((base / 'source-discovery.local.json').read_text(encoding='utf-8-sig'))
storage = json.loads((base / 'storage-map.json').read_text(encoding='utf-8-sig'))
tables = defaultdict(list)
for column in source['resultSets'][0]:
    if column['ObjectName'].startswith(('_Reference159', '_Reference273')):
        tables[column['ObjectName']].append(column['ColumnName'])

def quote(value):
    return '[' + value.replace(']', ']]') + ']'

standard = {'_IDRRef': 'Ссылка', '_Version': 'ВерсияДанных', '_Marked': 'ПометкаУдаления',
            '_PredefinedID': 'ПредопределенныйИдентификатор', '_ParentIDRRef': 'Родитель',
            '_Code': 'Код', '_Description': 'Наименование', '_Fld771': 'РазделительДанных',
            '_OwnerID_TYPE': 'Владелец_TYPE', '_OwnerID_RTRef': 'Владелец_RTRef',
            '_OwnerID_RRRef': 'Номенклатура', '_OwnerIDRRef': 'Владелец'}
manifest = []
dictionary = ['# Повні views номенклатури', '',
              'SQL створює окремі views у **vsmarket_bi**, які читають **vsmarket**. Існуючі views не замінюються.', '',
              'У кожному view є всі фізичні колонки та зрозумілі псевдоніми реквізитів з XML. Нерозшифровані колонки також збережено. Табличні частини винесено в окремі views, щоб не множити товарні рядки.', '',
              '**Дати збережено в кодуванні 1С без автоматичного зсуву року.** Одиниці розмірів не підставлено. Склад у картці не означає фактичний залишок. Ці views призначені для внутрішнього адаптера, а не для видачі всіх полів покупцю.', '',
              'Ознака ЭтоГруппа виправлена: `_Folder=0x00` — група, `0x01` — товар. ПометкаУдаления та булеві реквізити мають окремі псевдоніми типу bit; сирі колонки залишаються без змін.', '',
              'Рядки з позначкою видалення і всі розділювачі даних збережено. Відбір публічних товарів має виконувати адаптер.', '',
              'Додаткові реквізити містять усі компоненти складеного значення. Назви властивостей читаються з _Chrc747; назви значень розшифровано лише для підтвердженого типу _Reference108 (0x0000006C). Інші посилальні типи зберігаються сирими.', '',
              '| View | Джерело | Фізичних колонок | Колонок view |', '|---|---|---:|---:|']

for table, columns in sorted(tables.items()):
    catalog = 'Номенклатура' if table.startswith('_Reference159') else 'ХарактеристикиНоменклатуры'
    section = None
    if '_VT' in table:
        number = table.split('_VT')[1]
        section = next(row['name'].split('.TabularSection.')[1] for row in storage
                       if row['name'].startswith('Catalog.' + catalog + '.TabularSection.')
                       and '.Attribute.' not in row['name'] and ['VT', number] in row.get('sql', []))
    name = 'Справочники.' + catalog + ('.' + section if section else '') + '.Полная'
    expressions = ['    t.' + quote(column) for column in columns]
    aliases = set(columns)
    def add(expression, alias):
        if alias in aliases:
            raise ValueError('Duplicate alias: ' + name + '.' + alias)
        aliases.add(alias)
        expressions.append('    ' + expression + ' AS ' + quote(alias))
    for column in columns:
        if column in standard:
            expression = 't.' + quote(column)
            if column == '_Marked':
                expression = 'CONVERT(bit, ' + expression + ')'
            add(expression, standard[column])
        elif column == '_Folder':
            add('CONVERT(bit, CASE WHEN t.[_Folder]=0x00 THEN 1 WHEN t.[_Folder]=0x01 THEN 0 ELSE NULL END)', 'ЭтоГруппа')
        elif column.startswith('_Reference') and column.endswith('_IDRRef'):
            add('t.' + quote(column), 'Владелец')
        elif column.startswith('_LineNo'):
            add('t.' + quote(column), 'НомерСтроки')
        elif column == '_KeyField':
            add('t.' + quote(column), 'КлючСтроки')
    field_count = 0
    for field in fields:
        matched = [entry.split('.', 1)[1] for entry in field['liveSourceColumns']
                   if entry.split('.', 1)[0] == table]
        if not matched:
            continue
        field_count += 1
        attribute = field['source'].split('.')[-1]
        for column in matched:
            suffix = '' if len(matched) == 1 else '_' + column.split('_', 2)[-1]
            expression = 't.' + quote(column)
            if len(matched) == 1 and field['type'] == 'xs:boolean':
                expression = 'CONVERT(bit, ' + expression + ')'
            add(expression, attribute + suffix)
    joins = ''
    if section == 'ДополнительныеРеквизиты':
        prop = '_Fld14135RRef' if catalog == 'Номенклатура' else '_Fld16491RRef'
        val = '_Fld14136' if catalog == 'Номенклатура' else '_Fld16492'
        joins = (f'\nLEFT JOIN [vsmarket].[dbo].[_Chrc747] p ON p.[_IDRRef]=t.{quote(prop)} AND p.[_Fld771]=t.[_Fld771]'
                 f'\nLEFT JOIN [vsmarket].[dbo].[_Reference108] v ON v.[_IDRRef]=t.{quote(val + "_RRRef")} AND t.{quote(val + "_RTRef")}=0x0000006C AND v.[_Fld771]=t.[_Fld771]')
        add('p.[_Description]', 'СвойствоНаименование')
        add('v.[_Description]', 'ЗначениеСправочникаНаименование')
    if not section and catalog == 'Номенклатура':
        # Preserve the three public aliases already used by the existing BI view.
        for column, alias in [('_Fld14076RRef', 'Постачальник'), ('_Fld14079RRef', 'Виробник'), ('_Fld14062RRef', 'Категорія')]:
            add('t.' + quote(column), alias)
    projection = 'SELECT\n' + ',\n'.join(expressions) + '\nFROM [vsmarket].[dbo].' + quote(table) + ' t' + joins
    assert len(aliases) <= 1024, 'SQL Server view column limit exceeded'
    assert max(map(len, aliases)) <= 128 and len(name) <= 128, 'SQL Server identifier limit exceeded'
    manifest.append({'name': name, 'table': table, 'rawColumns': len(columns),
                     'viewColumns': len(aliases), 'metadataFields': field_count,
                     'select': projection})
    dictionary.append(f'| dbo.{name} | {table} | {len(columns)} | {len(aliases)} |')

assert sum(item['metadataFields'] for item in manifest) == len(fields), 'Incomplete field coverage'
assert len(manifest) == len(tables), 'Missing source table'
sql = ['-- Generated from verified live schema and VS Market 1C metadata.',
       '-- Review and run in vsmarket_bi. No changes to vsmarket tables or existing BI views.',
       '-- Dates and composite value encodings are preserved as stored in 1C.',
       'USE [vsmarket_bi];', 'GO', 'SET ANSI_NULLS ON;', 'GO', 'SET QUOTED_IDENTIFIER ON;', 'GO']
for item in manifest:
    sql.extend(['', '-- ' + item['table'] + ': all physical columns + mapped semantic aliases.',
                'CREATE OR ALTER VIEW [dbo].' + quote(item['name']) + '\nAS\n' + item['select'] + ';', 'GO'])
(base / 'nomenclature-full-views.sql').write_text('\n'.join(sql) + '\n', encoding='utf-8-sig')
(base / 'full-views.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
dictionary.extend(['', '## Використання', '',
                   'Скрипт підготовлено для ручного застосування в SSMS обліковим записом з правами CREATE VIEW / ALTER у vsmarket_bi та SELECT у vsmarket. Скрипт не створює користувачів і не змінює дані 1С.', '',
                   '```sql', 'SELECT TOP (100) [Ссылка], [Код], [Наименование], [Артикул], [Ширина], [Высота]',
                   'FROM [vsmarket_bi].[dbo].[Справочники.Номенклатура.Полная]',
                   'WHERE [ЭтоГруппа]=0 AND [ПометкаУдаления]=0 AND [РазделительДанных]=0;', '```', '',
                   'При з’єднанні характеристик і табличних частин використовуйте ідентифікатор власника та РазделительДанных. Технічні посилання залишаються binary(16); за потреби відображення: CONVERT(varchar(34), [Ссылка], 1).', '',
                   'Після зміни конфігурації 1С повторно звірте фізичні колонки й оновіть views: імена _Fld… прив’язані до цієї конкретної бази.'])
(base / 'nomenclature-full-views.md').write_text('\n'.join(dictionary) + '\n', encoding='utf-8')
print(json.dumps([{'name': item['name'], 'raw': item['rawColumns'], 'columns': item['viewColumns'], 'fields': item['metadataFields']} for item in manifest], ensure_ascii=False))
