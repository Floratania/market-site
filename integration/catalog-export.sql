-- SELECT only. Parameters supplied by export-catalog.mjs.
-- Physical mappings: ConfigDumpInfo + DBNames; live source columns must be checked before export.
;WITH Tree AS (
 SELECT _IDRRef,_ParentIDRRef,_Folder,0 AS Depth,CAST(_Description AS nvarchar(4000)) AS GroupPath
 FROM [vsmarket].dbo._Reference159
 WHERE _Code=@groupCode AND _Fld771=@separator AND _Marked=0x00 AND _Folder=0x00
 UNION ALL
 SELECT n._IDRRef,n._ParentIDRRef,n._Folder,t.Depth+1,
 CAST(t.GroupPath+CASE WHEN n._Folder=0x00 THEN N' / '+n._Description ELSE N'' END AS nvarchar(4000))
 FROM [vsmarket].dbo._Reference159 n JOIN Tree t ON n._ParentIDRRef=t._IDRRef
 WHERE n._Fld771=@separator AND n._Marked=0x00
)
SELECT CONVERT(varchar(34),n._IDRRef,1) AS ProductRef,
 CONVERT(varchar(34),n._ParentIDRRef,1) AS ParentRef,
 RTRIM(n._Code) AS Code,n._Description AS Name,n._Fld14036 AS Article,
 parent._Description AS GroupName,t.GroupPath,kind.ConstructionKind,
 CONVERT(varchar(40),n._Fld14105) AS WidthRaw,
 CONVERT(varchar(40),n._Fld14047) AS HeightRaw,
 CONVERT(varchar(34),n._Fld14038RRef,1) AS UnitRef
FROM Tree t JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=t._IDRRef AND n._Fld771=@separator
LEFT JOIN [vsmarket].dbo._Reference159 parent ON parent._IDRRef=n._ParentIDRRef AND parent._Fld771=n._Fld771
OUTER APPLY (
 SELECT CASE WHEN COUNT_BIG(*)=1 THEN MAX(CASE WHEN d._Fld14136_TYPE=0x08 AND d._Fld14136_RTRef=0x0000006C THEN v._Description ELSE NULLIF(d._Fld14136_S,N'') END) ELSE NULL END AS ConstructionKind
 FROM [vsmarket].dbo._Reference159_VT14133 d
 LEFT JOIN [vsmarket].dbo._Reference108 v ON v._IDRRef=d._Fld14136_RRRef AND v._Fld771=d._Fld771 AND v._Marked=0x00
 WHERE d._Reference159_IDRRef=n._IDRRef AND d._Fld771=n._Fld771 AND d._Fld14135RRef=0x89BE000C29A12DB811EF05F8CC8AC3C2
) kind
WHERE t._Folder=0x01 AND n._Fld14069=0x00
ORDER BY n._Code OPTION(MAXRECURSION 100);

;WITH Tree AS (
 SELECT _IDRRef,_Folder FROM [vsmarket].dbo._Reference159
 WHERE _Code=@groupCode AND _Fld771=@separator AND _Marked=0x00 AND _Folder=0x00
 UNION ALL
 SELECT n._IDRRef,n._Folder FROM [vsmarket].dbo._Reference159 n JOIN Tree t ON n._ParentIDRRef=t._IDRRef
 WHERE n._Fld771=@separator AND n._Marked=0x00
)
SELECT CONVERT(varchar(34),h._OwnerID_RRRef,1) AS ProductRef,
 CONVERT(varchar(34),h._IDRRef,1) AS VariantRef,
 RTRIM(h._Code) AS Code,h._Description AS Name,h._Fld16484 AS Article,
 CONVERT(varchar(40),h._Fld17290) AS WidthRaw,
 CONVERT(varchar(40),h._Fld17291) AS HeightRaw,
 h._Fld17292 AS Color,h._Fld17293 AS Profile,h._Fld17294 AS VariantType
FROM [vsmarket].dbo._Reference273 h
JOIN Tree t ON t._IDRRef=h._OwnerID_RRRef AND t._Folder=0x01
JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=t._IDRRef AND n._Fld771=@separator AND n._Fld14069=0x00
WHERE h._Fld771=@separator AND h._Marked=0x00 AND h._Fld16486=0x00
 AND h._OwnerID_TYPE=0x08 AND h._OwnerID_RTRef=0x0000009F
ORDER BY h._OwnerID_RRRef,h._Code OPTION(MAXRECURSION 100);

;WITH Tree AS (
 SELECT _IDRRef,_Folder FROM [vsmarket].dbo._Reference159
 WHERE _Code=@groupCode AND _Fld771=@separator AND _Marked=0x00 AND _Folder=0x00
 UNION ALL
 SELECT n._IDRRef,n._Folder FROM [vsmarket].dbo._Reference159 n JOIN Tree t ON n._ParentIDRRef=t._IDRRef
 WHERE n._Fld771=@separator AND n._Marked=0x00
), Prices AS (
 SELECT p._Fld10552RRef AS ProductRef,p._Fld10553RRef AS VariantRef,
 p._Fld10554 AS Amount,p._Fld10555 AS IsActual,
 p._Fld10556_TYPE AS UnitValueType,p._Fld10556_RTRef AS UnitReferenceType,p._Fld10556_RRRef AS UnitRef,
 p._Fld10557 AS IncludesVariants,p._Period AS RawPeriod,
 CASE WHEN YEAR(p._Period)<3753 THEN p._Period ELSE DATEADD(YEAR,-2000,p._Period) END AS Period,
 ROW_NUMBER() OVER(PARTITION BY p._Fld10552RRef,p._Fld10553RRef ORDER BY p._Period DESC) AS Position,
 COUNT(*) OVER(PARTITION BY p._Fld10552RRef,p._Fld10553RRef,p._Period) AS SamePeriodRows
 FROM [vsmarket].dbo._InfoRg10550 p
 JOIN Tree t ON t._IDRRef=p._Fld10552RRef AND t._Folder=0x01
 JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=t._IDRRef AND n._Fld771=@separator AND n._Fld14069=0x00
 WHERE p._Fld771=@separator AND p._Fld10551RRef=@priceType
 AND (CASE WHEN YEAR(p._Period)<3753 THEN p._Period ELSE DATEADD(YEAR,-2000,p._Period) END)<=@asOf
)
SELECT CONVERT(varchar(34),ProductRef,1) AS ProductRef,
 CONVERT(varchar(34),VariantRef,1) AS VariantRef,
 CONVERT(varchar(40),Amount) AS Amount,
 CONVERT(bit,IsActual) AS IsActual,
 CONVERT(varchar(4),UnitValueType,1) AS UnitValueType,
 CONVERT(varchar(10),UnitReferenceType,1) AS UnitReferenceType,
 CONVERT(varchar(34),UnitRef,1) AS UnitRef,
 CONVERT(bit,IncludesVariants) AS IncludesVariants,
 CONVERT(varchar(33),Period,126) AS PeriodLocal,
 SamePeriodRows
FROM Prices WHERE Position=1 ORDER BY ProductRef,VariantRef OPTION(MAXRECURSION 100);

;WITH Tree AS (
 SELECT _IDRRef,_Folder FROM [vsmarket].dbo._Reference159
 WHERE _Code=@groupCode AND _Fld771=@separator AND _Marked=0x00 AND _Folder=0x00
 UNION ALL
 SELECT n._IDRRef,n._Folder FROM [vsmarket].dbo._Reference159 n JOIN Tree t ON n._ParentIDRRef=t._IDRRef
 WHERE n._Fld771=@separator AND n._Marked=0x00
)
SELECT CONVERT(varchar(34),s._Fld9276RRef,1) AS ProductRef,
 CONVERT(varchar(34),s._Fld9277RRef,1) AS VariantRef,
 RTRIM(w._Code) AS WarehouseCode,w._Description AS WarehouseName,
 CONVERT(varchar(50),SUM(s._Fld9279)) AS Available,
 CONVERT(varchar(50),SUM(s._Fld9280)) AS Reserved
FROM [vsmarket].dbo._InfoRg9273 s
JOIN Tree t ON t._IDRRef=s._Fld9276RRef AND t._Folder=0x01
JOIN [vsmarket].dbo._Reference159 n ON n._IDRRef=t._IDRRef AND n._Fld771=@separator AND n._Fld14069=0x00
JOIN [vsmarket].dbo._Reference251 w ON w._IDRRef=s._Fld9275_RRRef AND w._Fld771=s._Fld771
WHERE s._Fld771=@separator AND w._Marked=0x00
 AND s._Fld9275_TYPE=0x08 AND s._Fld9275_RTRef=0x000000FB
 AND w._Code IN(N'26-000004',N'26-000005')
GROUP BY s._Fld9276RRef,s._Fld9277RRef,w._Code,w._Description
ORDER BY s._Fld9276RRef,s._Fld9277RRef,w._Code OPTION(MAXRECURSION 100);
