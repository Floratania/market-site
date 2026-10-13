from pathlib import Path
import json

base = Path(__file__).parent
audit = json.loads((base / 'saleor-mssql-audit.json').read_text(encoding='utf-8-sig'))
manifest = json.loads((base / 'full-views.manifest.json').read_text(encoding='utf-8-sig'))
source = json.loads((base / 'source-discovery.local.json').read_text(encoding='utf-8-sig'))
lines = ['# База Saleor і MSSQL VS Market', '',
         'Для цього проєкту обрано PostgreSQL для Saleor та MSSQL як джерело 1С. Перенесення Saleor на MSSQL не виконано.', '',
         'Перевірено Python-код встановленого образу Saleor 3.23. Django: ' + audit['django'] + '; psycopg: ' + audit['psycopg'] + '.', '',
         '| Механізм | Файлів загалом | Файлів без міграцій і тестів |', '|---|---:|---:|']
for term, files in audit['dependencies'].items():
    if not files:
        continue
    application = [file for file in files if '/migrations/' not in file and '/tests/' not in file and not file.endswith('/tests.py')]
    lines.append(f'| {term} | {len(files)} | {len(application)} |')
lines += ['', 'Кількості не складаються: один файл може використовувати кілька механізмів. Це пошук згадок у коді, а не оцінка всіх потрібних змін.', '',
          'MSSQL-драйвер для Django не замінює PostgreSQL-специфічні поля, пошук, індекси, SQL і транзакційні блокування Saleor. Потрібні переробка міграцій, перевірка API та checkout, гарантій резервування і сумісності майбутніх оновлень.', '',
          '## Схема інтеграції', '',
          '1. MSSQL / 1С зберігає облікові товари, ціни та залишки.',
          '2. Серверний адаптер читає підтверджені views і синхронізує товари, варіанти та склади через API Saleor.',
          '3. Saleor зберігає свій каталог, публікацію і замовлення у PostgreSQL. Керування базою — через pgAdmin.', '',
          'Синхронізація реальних товарів ще не активована. Нові views підготовлені, але не встановлені у SQL Server.', '',
          'Джерела: [моделі Saleor 3.23](https://github.com/saleor/saleor/blob/3.23/saleor/product/models.py), [Microsoft mssql-django](https://github.com/microsoft/mssql-django).']
(base / 'saleor-mssql-decision.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
status = {'sourceSchemaCheckedAt': source['checkedAt'], 'verification': 'offline metadata coverage only',
          'views': len(manifest), 'metadataFieldsCovered': sum(view['metadataFields'] for view in manifest),
          'physicalColumnsCovered': sum(view['rawColumns'] for view in manifest),
          'liveSelectCompilation': 'pending: user and password are empty in local configuration',
          'databaseChangesApplied': False}
(base / 'full-views-status.json').write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding='utf-8')
readme = base / 'nomenclature-full-views.md'
# Regenerating the decision report must not duplicate the verification section.
readme.write_text(readme.read_text(encoding='utf-8').split('\n## Перевірка\n')[0], encoding='utf-8')
with readme.open('a', encoding='utf-8') as document:
    document.write('\n## Перевірка\n\n')
    document.write(f'Використано структуру SQL Server, перевірену {source["checkedAt"]}. Зіставлено всі 123 реквізити та всі {status["physicalColumnsCovered"]} фізичні колонки п’яти таблиць. Перевірено унікальність назв і обмеження SQL Server на довжину і кількість колонок.\n\n')
    document.write('Скрипт використовує CREATE OR ALTER VIEW, для якого потрібен SQL Server 2016 SP1 або новіший. Версію сервера необхідно звірити перед застосуванням. [Документація Microsoft](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-view-transact-sql).\n\n')
    document.write('Компіляцію SELECT на живій базі ще не підтверджено: у локальному файлі підключення порожні user і password. SQL на сервері не застосовано. Перевірка без DDL: `node integration/verify-full-views.mjs`.\n')
print(f'Prepared {status["views"]} views, covering {status["metadataFieldsCovered"]} fields and {status["physicalColumnsCovered"]} physical columns. Live compilation pending.')
