import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {orderSettings,settingsPath} from './order-settings.mjs';
const file=new URL('./shop-settings.local.json',import.meta.url);
const defaults={phone:'+380 66 670 97 77',email:'info@vstmarket.com.ua',facebook:'https://www.facebook.com/vsmarketua',instagram:'https://www.instagram.com/VSMARKET.UA',tiktok:'https://www.tiktok.com/@vsmarket.ua',heroTitle:'Ваш дім починається з деталей.',heroText:'Сучасні вікна та двері для затишку, комфорту і безпеки вашої оселі.',heroImage:'/assets/hero-house.png',windowImage:'/assets/window.png',doorImage:'/assets/door.png',extrasImage:'/assets/hardware.png',directionImages:{},featuredSkus:[]};
const problem=message=>Object.assign(new Error(message),{status:400});
const url=value=>{if(!value)return '';if(/^\/assets\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('..'))return value;try{const parsed=new URL(value);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)return parsed.href;}catch{}throw problem('Вкажіть HTTPS-посилання або шлях /assets/.');};
export async function shopSettings(){try{return {...defaults,...JSON.parse(await fs.readFile(file,'utf8'))};}catch(e){if(e.code==='ENOENT')return structuredClone(defaults);throw e;}}
const write=async(path,data)=>{await fs.writeFile(new URL(path.href+'.tmp'),JSON.stringify(data,null,2)+'\n',{mode:0o600});await fs.rename(new URL(path.href+'.tmp'),path);};
export async function saveShopSettings(body){
 const saved={};for(const key of ['phone','email','heroTitle','heroText']){if(typeof body[key]!=='string'||body[key].length>(key==='heroText'?1000:200))throw problem('Перевірте контактні дані й текст банера.');saved[key]=body[key].trim();}
 if(!/^\+?[\d ()-]{10,30}$/.test(saved.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved.email))throw problem('Перевірте телефон і email.');
 for(const key of ['facebook','instagram','tiktok','heroImage','windowImage','doorImage','extrasImage'])saved[key]=url(body[key]);
 if(!Array.isArray(body.featuredSkus)||body.featuredSkus.length>12||body.featuredSkus.some(s=>typeof s!=='string'||s.length>100))throw problem('До 12 артикулів рекомендованих товарів.');saved.featuredSkus=[...new Set(body.featuredSkus.map(s=>s.trim()).filter(Boolean))];
 saved.directionImages={};for(const [name,image] of Object.entries(body.directionImages||{})){if(name.length>100||Object.keys(saved.directionImages).length>=6)throw problem('Перевірте фотографії категорій.');saved.directionImages[name]=url(image);}
 await write(file,saved);return saved;
}
export async function notificationSettings(){const c=await orderSettings();return {email:{enabled:!!c.email?.enabled,to:c.email?.to||'tania.flyora@gmail.com',user:c.email?.user||'tania.flyora@gmail.com',hasPassword:!!c.email?.password},telegram:{enabled:!!c.telegram?.enabled,chatId:String(c.telegram?.chatId||''),hasToken:!!c.telegram?.botToken}};}
export async function saveNotificationSettings(body){
 const c=await orderSettings(),email=body.email||{},tg=body.telegram||{};
 if(typeof email.to!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.to)||typeof email.user!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.user))throw problem('Перевірте email отримувача й відправника.');
 c.email={...c.email,host:'smtp.gmail.com',port:465,secure:true,enabled:email.enabled===true,to:email.to.trim(),user:email.user.trim(),from:email.user.trim()};
 if(email.password){if(typeof email.password!=='string'||email.password.length>200)throw problem('Перевірте пароль додатка.');c.email.password=email.password.replace(/\s/g,'');}
 c.telegram={...c.telegram,enabled:tg.enabled===true,chatId:String(tg.chatId||c.telegram?.chatId||'')};
 if(tg.botToken){if(typeof tg.botToken!=='string'||!/^\d+:[A-Za-z0-9_-]{20,100}$/.test(tg.botToken))throw problem('Перевірте токен Telegram-бота.');c.telegram.botToken=tg.botToken;}
 if(c.email.enabled&&!c.email.password)throw problem('Введіть пароль додатка Google.');
 if(c.telegram.enabled&&(!c.telegram.botToken||! /^-?\d+$/.test(c.telegram.chatId)))throw problem('Вкажіть токен та chat_id Telegram.');
 c.acceptOrders=true;await write(process.env.ORDER_SETTINGS_FILE?new URL('file:///'+process.env.ORDER_SETTINGS_FILE.replace(/\\/g,'/')):settingsPath,c);return notificationSettings();
}
export async function discoverTelegram(){
 const c=await orderSettings();if(!c.telegram?.botToken)throw problem('Спочатку збережіть токен бота з вимкненим Telegram.');
 const r=await fetch(`https://api.telegram.org/bot${c.telegram.botToken}/getUpdates`,{signal:AbortSignal.timeout(10000)}),data=await r.json();if(!r.ok||!data.ok)throw problem('Не вдалося прочитати чат бота. Перевірте токен і натисніть Start.');
 const chats=new Map();for(const u of data.result||[]){const chat=u.message?.chat;if(chat?.type==='private')chats.set(String(chat.id),{id:String(chat.id),name:chat.first_name||chat.username||'Особистий чат'});}return {chats:[...chats.values()]};
}
export async function uploadShopImage(body){
 if(typeof body.data!=='string'||body.data.length>1800000)throw problem('Фото має бути до 1 МБ у форматі PNG або JPEG.');
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(body.data);if(!match)throw problem('Оберіть PNG або JPEG.');const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>1024*1024||(match[1]==='png'?!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]!==255||bytes[1]!==216||bytes[2]!==255))throw problem('Некоректне фото або файл більший за 1 МБ.');
 const name=crypto.randomUUID()+'.'+(match[1]==='png'?'png':'jpg'),dir=new URL('../public/assets/uploads/',import.meta.url);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL(name,dir),bytes);return {url:'/assets/uploads/'+name};
}
