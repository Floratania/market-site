# База Saleor і MSSQL VS Market

Для цього проєкту обрано PostgreSQL для Saleor та MSSQL як джерело 1С. Перенесення Saleor на MSSQL не виконано.

Перевірено Python-код встановленого образу Saleor 3.23. Django: 5.2.18; psycopg: 3.2.9.

| Механізм | Файлів загалом | Файлів без міграцій і тестів |
|---|---:|---:|
| django.contrib.postgres | 188 | 23 |
| SearchVector | 43 | 21 |
| SearchRank | 1 | 1 |
| GinIndex | 71 | 12 |
| ArrayField | 8 | 3 |
| pg_advisory | 3 | 1 |
| jsonb | 35 | 3 |
| ::json | 1 | 1 |
| Trigram | 1 | 0 |

Кількості не складаються: один файл може використовувати кілька механізмів. Це пошук згадок у коді, а не оцінка всіх потрібних змін.

MSSQL-драйвер для Django не замінює PostgreSQL-специфічні поля, пошук, індекси, SQL і транзакційні блокування Saleor. Потрібні переробка міграцій, перевірка API та checkout, гарантій резервування і сумісності майбутніх оновлень.

## Схема інтеграції

1. MSSQL / 1С зберігає облікові товари, ціни та залишки.
2. Серверний адаптер читає підтверджені views і синхронізує товари, варіанти та склади через API Saleor.
3. Saleor зберігає свій каталог, публікацію і замовлення у PostgreSQL. Керування базою — через pgAdmin.

Синхронізація реальних товарів ще не активована. Нові views підготовлені, але не встановлені у SQL Server.

Джерела: [моделі Saleor 3.23](https://github.com/saleor/saleor/blob/3.23/saleor/product/models.py), [Microsoft mssql-django](https://github.com/microsoft/mssql-django).
