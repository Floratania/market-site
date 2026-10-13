-- READ ONLY: source vsmarket_bi. Inspect views as well as tables.
SELECT s.name AS SchemaName, o.name AS ObjectName, o.type_desc,
       c.column_id, c.name AS ColumnName, t.name AS DataType, c.max_length
FROM [vsmarket_bi].sys.objects o
JOIN [vsmarket_bi].sys.schemas s ON s.schema_id=o.schema_id
JOIN [vsmarket_bi].sys.columns c ON c.object_id=o.object_id
JOIN [vsmarket_bi].sys.types t ON t.user_type_id=c.user_type_id
WHERE o.type IN ('U','V')
  AND (o.name LIKE N'%ОстаткиТоваров%'
    OR o.name LIKE N'%ЗапасыНаСкладах%'
    OR o.name LIKE N'%РезервыТоваровОрганизаций%'
    OR o.name LIKE N'%Номенклатур%'
    OR o.name LIKE N'%СтруктурныеЕдиницы%'
    OR o.name LIKE N'%ДополнительныеРеквизиты%'
    OR o.name LIKE N'%ЗначенияСвойствОбъектов%'
    OR o.name LIKE N'[_]Reference159%'
    OR o.name LIKE N'[_]Reference273%'
    OR o.name IN (N'_Reference159',N'_Reference251',N'_Reference273',
                 N'_Reference159_VT14133',N'_Reference108',N'_Chrc747',
                 N'_InfoRg9273',N'_AccumRg11184'))
ORDER BY s.name,o.name,c.column_id;

-- View definitions and dependencies: detect omitted fields, joins and source DB.
-- NULL definitions can mean insufficient VIEW DEFINITION permission or encryption.
SELECT s.name AS SchemaName, v.name AS ViewName, m.definition AS ViewDefinition
FROM [vsmarket_bi].sys.views v
JOIN [vsmarket_bi].sys.schemas s ON s.schema_id=v.schema_id
LEFT JOIN [vsmarket_bi].sys.sql_modules m ON m.object_id=v.object_id
WHERE v.name LIKE N'%Номенклатур%' OR v.name LIKE N'%Остатки%'
   OR v.name LIKE N'%Запасы%' OR v.name LIKE N'%Дополнительные%'
   OR v.name LIKE N'%Свойств%' OR v.name LIKE N'%СтруктурныеЕдиницы%';

SELECT s.name AS SchemaName, v.name AS ViewName,
       d.referenced_server_name, d.referenced_database_name,
       d.referenced_schema_name, d.referenced_entity_name, d.referenced_minor_id
FROM [vsmarket_bi].sys.views v
JOIN [vsmarket_bi].sys.schemas s ON s.schema_id=v.schema_id
LEFT JOIN [vsmarket_bi].sys.sql_expression_dependencies d ON d.referencing_id=v.object_id
WHERE v.name LIKE N'%Номенклатур%' OR v.name LIKE N'%Остатки%'
   OR v.name LIKE N'%Запасы%' OR v.name LIKE N'%Дополнительные%'
   OR v.name LIKE N'%Свойств%' OR v.name LIKE N'%СтруктурныеЕдиницы%';

-- Synonyms can also route semantic names to another database.
SELECT s.name AS SchemaName, y.name AS SynonymName, y.base_object_name
FROM [vsmarket_bi].sys.synonyms y
JOIN [vsmarket_bi].sys.schemas s ON s.schema_id=y.schema_id;

-- Documented semantic directory already used in this project (table OR view).
SELECT [Код], [Наименование], CONVERT(varchar(34),[Ссылка],1) AS Ref,
       [ПометкаУдаления]
FROM [vsmarket_bi].[dbo].[Справочники.СтруктурныеЕдиницы]
WHERE [Код] IN (N'26-000004',N'26-000005');

SELECT [Код], [Наименование], CONVERT(varchar(34),[Ссылка],1) AS Ref,
       [ЭтоГруппа], [ПометкаУдаления]
FROM [vsmarket_bi].[dbo].[Справочники.Номенклатура]
WHERE [Код]=N'26-00000134';
