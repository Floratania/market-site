import os, shutil, json
from pathlib import Path
keys=['BI_DB_SERVER','BI_DB_PORT','BI_DB_DATABASE','BI_DB_USER','BI_DB_PASSWORD']
print(json.dumps({'environment':{k:bool(os.environ.get(k)) for k in keys},'sqlcmdInstalled':bool(shutil.which('sqlcmd')),'mssqlLibraryPresent':Path('miniapp/server/node_modules/mssql').exists()},indent=2))
