-- READ ONLY. Diagnostic scope, not an activated sellable-stock feed.
-- Folder encoding verified on root and its children: 0x00 folder, 0x01 item.
;WITH Tree AS (
 SELECT _IDRRef,_ParentIDRRef,_Folder,_Code,_Description,_Fld14069,0 AS Depth
 FROM [vsmarket].dbo._Reference159
 WHERE _Code=N'26-00000134' AND _Marked=0x00 AND _Fld771=0
 UNION ALL
 SELECT n._IDRRef,n._ParentIDRRef,n._Folder,n._Code,n._Description,n._Fld14069,p.Depth+1
 FROM [vsmarket].dbo._Reference159 n JOIN Tree p ON n._ParentIDRRef=p._IDRRef
 WHERE n._Marked=0x00 AND n._Fld771=0 AND p.Depth<16
)
SELECT CONVERT(varchar(4),_Folder,1) AS RawFolder,COUNT_BIG(*) AS Items,
 SUM(CASE WHEN _Fld14069=0x00 THEN 1 ELSE 0 END) AS ValidItems
FROM Tree GROUP BY _Folder OPTION(MAXRECURSION 20);

;WITH Tree AS (
 SELECT _IDRRef,_Folder,0 AS Depth FROM [vsmarket].dbo._Reference159
 WHERE _Code=N'26-00000134' AND _Marked=0x00 AND _Fld771=0
 UNION ALL
 SELECT n._IDRRef,n._Folder,p.Depth+1 FROM [vsmarket].dbo._Reference159 n JOIN Tree p ON n._ParentIDRRef=p._IDRRef
 WHERE n._Marked=0x00 AND n._Fld771=0 AND p.Depth<16
), Technical AS (
 SELECT s.Организация,s.СтруктурнаяЕдиница,s.Номенклатура,s.Характеристика,
 SUM(s.Количество) AS Available,SUM(s.Резерв) AS Reserved
 FROM [vsmarket_bi].dbo.[РегистрыСведений.ОстаткиТоваров] s
 JOIN Tree t ON t._IDRRef=s.Номенклатура AND t._Folder=0x01
 JOIN [vsmarket_bi].dbo.[Справочники.СтруктурныеЕдиницы] w ON w.Ссылка=s.СтруктурнаяЕдиница
 WHERE w.Код IN (N'26-000004',N'26-000005') AND w.ПометкаУдаления=0
 GROUP BY s.Организация,s.СтруктурнаяЕдиница,s.Номенклатура,s.Характеристика
)
SELECT TOP(40) CONVERT(varchar(34),s.Организация,1) AS OrganizationRef,w.Код AS WarehouseCode,w.Наименование AS Warehouse,
 n._Code AS ItemCode,n._Description AS ItemName,n._Fld14036 AS Article,
 CONVERT(varchar(34),s.Номенклатура,1) AS ItemRef,CONVERT(varchar(34),s.Характеристика,1) AS VariantRef,
 h._Description AS VariantName,n._Fld14105 AS ProductWidth,n._Fld14047 AS ProductHeight,
 h._Fld17290 AS VariantWidth,h._Fld17291 AS VariantHeight,h._Fld17292 AS Color,h._Fld17293 AS Profile,h._Fld17294 AS VariantType,
 s.Available,s.Reserved
FROM Technical s
JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=s.Номенклатура AND n._Fld771=0
JOIN [vsmarket_bi].dbo.[Справочники.СтруктурныеЕдиницы] w ON w.Ссылка=s.СтруктурнаяЕдиница
LEFT JOIN [vsmarket].dbo._Reference273 h ON h._IDRRef=s.Характеристика AND h._Fld771=0
WHERE n._Fld14069=0x00 AND (s.Available<>0 OR s.Reserved<>0)
ORDER BY n._Code,w.Код,s.Характеристика OPTION(MAXRECURSION 20);

;WITH Tree AS (
 SELECT _IDRRef,0 AS Depth FROM [vsmarket].dbo._Reference159 WHERE _Code=N'26-00000134' AND _Marked=0x00 AND _Fld771=0
 UNION ALL
 SELECT n._IDRRef,p.Depth+1 FROM [vsmarket].dbo._Reference159 n JOIN Tree p ON n._ParentIDRRef=p._IDRRef
 WHERE n._Marked=0x00 AND n._Fld771=0 AND p.Depth<16
)
SELECT TOP(100) n._Code AS ItemCode,n._Description AS ItemName,
 CONVERT(varchar(34),d._Fld14135RRef,1) AS PropertyRef,p._Description AS Property,
 CONVERT(varchar(4),d._Fld14136_TYPE,1) AS ValueType,
 d._Fld14136_S AS StringValue,d._Fld14136_N AS NumberValue,
 CONVERT(varchar(10),d._Fld14136_RTRef,1) AS ReferenceType,
 v._Description AS ReferencedValue,d._Fld14137 AS TextValue
FROM [vsmarket].dbo._Reference159_VT14133 d
JOIN Tree t ON t._IDRRef=d._Reference159_IDRRef
JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=t._IDRRef AND n._Fld771=d._Fld771
LEFT JOIN [vsmarket].dbo._Chrc747 p ON p._IDRRef=d._Fld14135RRef AND p._Fld771=d._Fld771
LEFT JOIN [vsmarket].dbo._Reference108 v ON v._IDRRef=d._Fld14136_RRRef AND d._Fld14136_RTRef=0x0000006C AND v._Fld771=d._Fld771
WHERE d._Fld771=0
ORDER BY n._Code,p._Description OPTION(MAXRECURSION 20);

SELECT _Fld771 AS DataSeparator,COUNT_BIG(*) AS Records FROM [vsmarket].dbo._InfoRg9273 GROUP BY _Fld771;
