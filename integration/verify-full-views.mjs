import fs from 'node:fs/promises';
import sql from 'mssql';
const base = new URL('./', import.meta.url);
const config = JSON.parse((await fs.readFile(new URL('bi-connection.local.json', base), 'utf8')).replace(/^\uFEFF/, ''));
const missing = ['server', 'database', 'user', 'password'].filter(key => !config[key]);
if (missing.length) {
  console.error(`Local connection fields missing: ${missing.join(', ')}. No connection attempted.`);
  process.exit(2);
}
const views = JSON.parse(await fs.readFile(new URL('full-views.manifest.json', base), 'utf8'));
const [server, instanceName] = config.server.split('\\');
const pool = new sql.ConnectionPool({
  server, database: config.database, user: config.user, password: config.password,
  ...(config.port ? {port: Number(config.port)} : {}),
  options: {encrypt: config.encrypt !== false, trustServerCertificate: config.trustServerCertificate === true,
    readOnlyIntent: true, ...(instanceName && !config.port ? {instanceName} : {})},
  connectionTimeout: 10000, requestTimeout: 30000, pool: {max: 1, min: 0}
});
const checks = [];
try {
  await pool.connect();
  for (const view of views) {
    // Compile the exact SELECT used in CREATE VIEW; read no source rows and perform no DDL.
    const result = await pool.request().query(view.select.replace(/^SELECT\n/, 'SELECT TOP (0)\n'));
    const columns = Object.keys(result.recordset.columns);
    if (columns.length !== view.viewColumns) throw new Error('Column coverage mismatch');
    checks.push({view: view.name, source: view.table, columns: columns.length,
      physicalColumns: view.rawColumns, metadataFields: view.metadataFields, compiled: true});
  }
  const sample = await pool.request().query(`
    SELECT _Code AS Code, CONVERT(varchar(4),_Folder,1) AS RawFolder,
      CONVERT(bit,CASE WHEN _Folder=0x00 THEN 1 WHEN _Folder=0x01 THEN 0 ELSE NULL END) AS IsFolder
    FROM [vsmarket].dbo._Reference159 WHERE _Code=N'26-00000134' AND _Fld771=0;
    SELECT TOP(1) CONVERT(varchar(4),_Folder,1) AS RawFolder,
      CONVERT(bit,CASE WHEN _Folder=0x00 THEN 1 WHEN _Folder=0x01 THEN 0 ELSE NULL END) AS IsFolder
    FROM [vsmarket].dbo._Reference159 WHERE _Folder=0x01 AND _Fld771=0;
  `);
  if (!sample.recordsets[0].length || !sample.recordsets[0].every(row => row.IsFolder === true)
      || !sample.recordsets[1].length || !sample.recordsets[1].every(row => row.IsFolder === false)) {
    throw new Error('Folder encoding verification failed');
  }
  const report = {checkedAt: new Date().toISOString(), mode: 'SELECT only; no views created',
    metadataFields: checks.reduce((sum, row) => sum + row.metadataFields, 0), checks,
    folderEncodingVerified: true};
  await fs.writeFile(new URL('full-views-validation.json', base), JSON.stringify(report, null, 2));
  console.log(`Verified ${checks.length} SELECT projections, ${report.metadataFields} metadata fields and folder encoding. No DDL executed.`);
} catch (error) {
  console.error(`View verification failed (${error.code || 'VALIDATION'}, ${error.number || 0}). Secrets and source rows are not logged.`);
  process.exitCode = 1;
} finally { await pool.close(); }
