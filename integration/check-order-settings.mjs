import fs from 'node:fs/promises';
import {orderSettings} from './order-settings.mjs';
import {notificationsReady,acceptingOrders} from './order-notifications.mjs';
const config=await orderSettings();
console.log({acceptingOrders:acceptingOrders(config),notificationsReady:notificationsReady(config),emailConfigured:Boolean(config.email?.password&&config.email?.user),telegramConfigured:Boolean(config.telegram?.botToken&&config.telegram?.chatId),novaApiKeyConfigured:Boolean(config.novaPoshta?.apiKey)});
let names=[];try{names=await fs.readdir(new URL('./orders/',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
let pending=0;
for(const name of names.filter(name=>/^[a-f0-9-]+\.json$/i.test(name))){const saved=JSON.parse(await fs.readFile(new URL('./orders/'+name,import.meta.url),'utf8'));if(Object.values(saved.notifications).some(item=>item.status!=='sent'))pending++;}
console.log({storedOrders:names.filter(name=>name.endsWith('.json')).length,ordersWithPendingNotifications:pending});
