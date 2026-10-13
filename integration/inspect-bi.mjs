import fs from 'node:fs/promises';
import sql from 'mssql';
const base = new URL('./', import.meta.url);
const queryFile = process.argv[2] || 'schema-discovery.sql';
if (!['schema-discovery.sql','source-discovery.sql','inventory-sample.sql'].includes(queryFile)) throw new Error('Unsupported inspection query');
let config;
try { config = JSON.parse((await fs.readFile(new URL('bi-connection.local.json', base), 'utf8')).replace(/^\uFEFF/, '')); }
catch { console.error('Cannot read valid bi-connection.local.json. No connection attempted.'); process.exit(2); }
if (!config.server || !config.database || !config.user || !config.password) {
  console.log('Configure server, database, user and password in integration/bi-connection.local.json. No connection attempted.');
  process.exit(2);
}
if (typeof config.server !== 'string' || typeof config.database !== 'string' || typeof config.user !== 'string' || typeof config.password !== 'string' || (config.port && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535))) {
  console.error('Invalid connection configuration. No connection attempted.'); process.exit(2);
}
const [server, instanceName] = config.server.split('\\');
const pool = new sql.ConnectionPool({
  server, database: config.database, user: config.user, password: config.password,
  ...(config.port ? { port: Number(config.port) } : {}),
  options: { encrypt: config.encrypt !== false, trustServerCertificate: config.trustServerCertificate === true, readOnlyIntent: true, ...(instanceName && !config.port ? { instanceName } : {}) },
  connectionTimeout: 10000, requestTimeout: 30000, pool: { max: 1, min: 0 },
});
try {
  await pool.connect();
  const result = await pool.request().query(await fs.readFile(new URL(queryFile, base), 'utf8'));
  const output = queryFile === 'schema-discovery.sql' ? 'bi-schema.local.json' : queryFile.replace('.sql','.local.json');
  await fs.writeFile(new URL(output, base), JSON.stringify({ checkedAt: new Date().toISOString(), server: config.server, database: config.database, resultSets: result.recordsets }, null, 2));
  console.log(`Saved schema inspection: ${result.recordsets.length} result sets.`);
} catch (error) {
  console.error(`SQL inspection failed (${error.code || 'UNKNOWN'}, ${error.number || 0}). Connection secrets are not logged.`);
  process.exitCode = 1;
} finally { await pool.close(); }
