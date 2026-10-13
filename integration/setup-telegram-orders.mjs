import fs from 'node:fs/promises';
import {orderSettings,settingsPath} from './order-settings.mjs';
const config=await orderSettings();
if(!config.telegram?.botToken){console.log('Додайте botToken у integration/order-settings.local.json, відкрийте бота в Telegram і натисніть Start.');process.exit(1);}
try{
  const call=async(method)=>{const response=await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/${method}`,{signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok||!result.ok)throw new Error('Telegram request failed');return result.result;};
  const me=await call('getMe');console.log('Бот: @'+me.username);
  const updates=await call('getUpdates');
  const chats=new Map();
  for(const update of updates){const message=update.message;if(message?.chat?.type==='private'&&/^\/start(?:\s|$)/.test(message.text||''))chats.set(String(message.chat.id),message.chat);}
  if(!chats.size){console.log('Відкрийте цього бота в Telegram і надішліть /start, потім повторіть команду.');process.exit(1);}
  for(const [chatId,chat]of chats)console.log(`chatId: ${chatId} — ${[chat.first_name,chat.last_name,chat.username?'@'+chat.username:''].filter(Boolean).join(' ')}`);
  const selected=process.argv[2];
  if(selected){if(!chats.has(selected))throw new Error('Chat not found');config.telegram.chatId=selected;await fs.writeFile(process.env.ORDER_SETTINGS_FILE||settingsPath,JSON.stringify(config,null,2)+'\n');console.log('Обраний особистий чат збережено.');}
  else console.log('Збережіть свій chatId у локальному файлі або повторіть цю команду з вашим chatId після назви скрипту.');
}catch{console.error('Не вдалося підключитися до бота. Перевірте токен і доступ до Telegram. Токен у чат не надсилайте.');process.exitCode=1;}
