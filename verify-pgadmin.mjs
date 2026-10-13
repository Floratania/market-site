import path from 'node:path';
import { spawn } from 'node:child_process';
const docker=`${process.env.LOCALAPPDATA}/Programs/DockerDesktop/resources/bin/docker.exe`;
const script=`import sqlite3, os, json
import psycopg
db=sqlite3.connect('/var/lib/pgadmin/pgadmin4.db')
columns=[row[1] for row in db.execute('PRAGMA table_info(server)')]
selected=[name for name in ['name','host','port','maintenance_db','username','connection_params'] if name in columns]
servers=db.execute('SELECT '+','.join(selected)+' FROM server').fetchall()
print('Saved servers:',servers)
assert any('db' in row for row in servers), 'Saleor server registration missing'
passfile='/var/lib/pgadmin/storage/'+os.environ['PGADMIN_DEFAULT_EMAIL'].replace('@','_')+'/.pgpass'
assert os.path.exists(passfile), 'Passfile missing'
assert os.stat(passfile).st_mode & 0o777 == 0o600, 'Incorrect passfile permissions'
with psycopg.connect(host='db',port=5432,dbname='saleor',user='saleor',passfile=passfile,connect_timeout=5) as connection:
 with connection.cursor() as cursor:
  cursor.execute("SELECT current_database(), count(*) FROM information_schema.tables WHERE table_schema='public'")
  print('Database connection verified:',cursor.fetchone())
`;
const run=()=>new Promise((resolve,reject)=>{
 const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','pgadmin','/venv/bin/python3','-c',script],{cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
 child.on('error',reject);child.on('exit',code=>code===0 ? resolve() : reject(new Error(`pgAdmin check exited ${code}`)));
});
const response=await fetch('http://127.0.0.1:5050/login',{signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error('pgAdmin login not available');
console.log('pgAdmin login HTTP',response.status);
await run();
