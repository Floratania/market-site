import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const parent=path.resolve(root,'.runtime','checkout-ui-tests');
const directory=path.join(parent,crypto.randomUUID());
await fs.mkdir(directory,{recursive:true});
const settings=path.join(directory,'settings.json');
await fs.writeFile(settings,JSON.stringify({acceptOrders:true,email:{enabled:false},telegram:{enabled:false}}));
const source=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{products:{pageInfo:{hasNextPage:false,endCursor:null},edges:[{node:{id:'test-model',name:'Тестові двері — перевірка оформлення',slug:'test-checkout-door',category:{name:'Двері'},metadata:[],variants:[{id:'test-variant',name:'960 × 2050 мм · Білий · Праве відкривання',sku:'CHECKOUT-TEST-ONLY',quantityAvailable:5,pricing:{price:{gross:{amount:150,currency:'UAH'}}}}]}}]}}}));});
source.listen(0,'127.0.0.1');await once(source,'listening');
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'18795',SALEOR_GRAPHQL_URL:`http://127.0.0.1:${source.address().port}/graphql`,ORDER_SETTINGS_FILE:settings,ORDER_STORAGE_DIR:path.join(directory,'orders')},stdio:['ignore','inherit','inherit'],windowsHide:true});
async function cleanup(){
  child.kill();if(child.exitCode===null)await once(child,'exit');await new Promise(resolve=>source.close(resolve));
  const actual=await fs.realpath(directory);
  if(!actual.startsWith(parent+path.sep)||path.basename(actual)!==path.basename(directory))throw new Error('Unsafe test cleanup path');
  await fs.rm(actual,{recursive:true,force:true});process.exit();
}
process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
console.log('Isolated UI test: http://127.0.0.1:18795/catalog — notifications disabled; temporary data only.');
