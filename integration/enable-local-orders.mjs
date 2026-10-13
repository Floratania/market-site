import fs from 'node:fs/promises';
import {orderSettings,settingsPath} from './order-settings.mjs';
const config=await orderSettings();config.acceptOrders=true;
await fs.writeFile(settingsPath,JSON.stringify(config,null,2)+'\n');
console.log('Local order storage enabled. Existing notification settings preserved.');
