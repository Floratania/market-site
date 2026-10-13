-- Read-only validation of physical source confirmed by live BI view definitions.
SELECT o.name AS ObjectName, c.column_id, c.name AS ColumnName, t.name AS DataType
FROM [vsmarket].sys.objects o
JOIN [vsmarket].sys.columns c ON c.object_id=o.object_id
JOIN [vsmarket].sys.types t ON t.user_type_id=c.user_type_id
WHERE o.type='U' AND (o.name LIKE N'[_]Reference159%'
 OR o.name LIKE N'[_]Reference273%' OR o.name=N'_Reference108'
 OR o.name=N'_Chrc747' OR o.name=N'_InfoRg9273')
ORDER BY o.name,c.column_id;

SELECT TOP(10) n._Code AS Code,n._Description AS Name,
 CONVERT(varchar(34),n._IDRRef,1) AS Ref,
 CONVERT(varchar(4),n._Folder,1) AS RawFolder,
 (SELECT COUNT_BIG(*) FROM [vsmarket].dbo._Reference159 child WHERE child._ParentIDRRef=n._IDRRef) AS DirectChildren
FROM [vsmarket].dbo._Reference159 n WHERE n._Code=N'26-00000134';

SELECT TOP(10) n._Code AS Code,n._Description AS Name,
 CONVERT(varchar(4),n._Folder,1) AS RawFolder,
 CONVERT(varchar(34),n._ParentIDRRef,1) AS ParentRef
FROM [vsmarket].dbo._Reference159 n
WHERE n._ParentIDRRef IN (SELECT _IDRRef FROM [vsmarket].dbo._Reference159 WHERE _Code=N'26-00000134')
ORDER BY n._Code;
