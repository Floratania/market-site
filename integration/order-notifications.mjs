import { orderSettings } from './order-settings.mjs';
import {createRequire} from 'node:module';
const money=value=>Number(value).toLocaleString('uk-UA')+' грн';
export function notificationChannels(config) {
  const result=[];
  if(config.email?.enabled)result.push('email');
  if(config.telegram?.enabled)result.push('telegram');
  return result;
}
export function notificationsReady(config) {
  const channels=notificationChannels(config);
  return channels.length>0&&channels.every(channel=>channel==='email' ? Boolean(config.email.to&&config.email.from&&config.email.host&&config.email.user&&config.email.password) : Boolean(config.telegram.botToken&&String(config.telegram.chatId||'').match(/^-?\d+$/)));
}
export function acceptingOrders(config){return config.acceptOrders===false?false:config.acceptOrders===true?true:notificationsReady(config);}
export function orderText(order) {
  const delivery=order.shipping?.kind==='branch'?`Нова пошта: ${order.shipping.city}, ${order.shipping.warehouse}`:order.shipping?.kind==='address'?`Нова пошта, кур’єр: ${order.shipping.city}, ${order.shipping.street}, ${order.shipping.house}${order.shipping.apartment?', кв. '+order.shipping.apartment:''}`:order.delivery==='pickup'?`Самовивіз: ${order.location==='mamaivtsi'?'Мамаївці':'Магала'}`:'Отримання узгодити з менеджером';
  const lines=order.lines.map((line,index)=>`${index+1}. ${line.name}\n${line.variantName||''}\nАртикул: ${line.sku||'Індивідуальний виріб'} · ${line.quantity} шт. · ${line.unitPrice==null?'Ціна за розрахунком':money(line.unitPrice*line.quantity)}`).join('\n\n');
  const total=order.pricing?.total??order.lines.reduce((sum,line)=>sum+(line.unitPrice||0)*line.quantity,0);
  return `VS Market — нове замовлення № ${order.id.slice(0,8).toUpperCase()}\n${order.createdAt}\n\n${order.customer.name}\nТелефон: ${order.customer.phone}${order.customer.email?'\nEmail: '+order.customer.email:''}\n\n${delivery}\nОплата: ${order.payment?.label||'Узгодити з менеджером'} · Не оплачено${order.pricing?.discount?'\nПромокод '+order.pricing.promotion?.code+' · Знижка '+money(order.pricing.discount)+' (потребує підтвердження)':''}${order.shipping?.verified===false?'\nАдресу потрібно підтвердити з покупцем.':''}\n\n${lines}\n\nОрієнтовна сума: ${money(total)}${order.lines.some(line=>line.unitPrice==null)?' + індивідуальні вироби за розрахунком':''}\nДоставка розраховується окремо.\n${order.comment?'\nКоментар: '+order.comment:''}\n\nID: ${order.id}`;
}
let mailer;
export async function getMailer(){
  if(!mailer)mailer=import('nodemailer').then(module=>module.default||module).catch(()=>createRequire(new URL('../.runtime/mail/package.json',import.meta.url))('nodemailer'));
  return mailer;
}
export async function sendNotification(channel, order, config, {fetchImpl=fetch,mailTransport}={}) {
  const text=orderText(order);
  if(channel==='email') {
    const email=config.email;
    const transport=mailTransport||(await getMailer()).createTransport({host:email.host,port:Number(email.port)||465,secure:email.secure!==false,requireTLS:true,auth:{user:email.user,pass:email.password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
    const result=await transport.sendMail({from:{name:'VS Market',address:email.from},to:email.to,subject:`VS Market — замовлення № ${order.id.slice(0,8).toUpperCase()}`,text,messageId:`<${order.id}@orders.vsmarket.local>`,...(order.customer.email?{replyTo:order.customer.email}:{})});
    if(!result.accepted?.length||result.rejected?.length)throw new Error('Email notification not accepted');
    return;
  }
  if(channel==='telegram') {
    // Split complete lines without Telegram markup: customer text cannot become HTML or links.
    const parts=[];let part='';
    for(const line of text.split('\n')) {
      if(part.length+line.length+1>3500){parts.push(part);part='';}
      if(line.length>3500){for(let i=0;i<line.length;i+=3500)parts.push(line.slice(i,i+3500));}
      else part+=(part?'\n':'')+line;
    }
    if(part)parts.push(part);
    for(const message of parts) {
      const response=await fetchImpl(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:config.telegram.chatId,text:message,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(10000)});
      const result=await response.json();
      if(!response.ok||result.ok!==true)throw new Error('Telegram notification not accepted');
    }
    return;
  }
  throw new Error('Unknown notification channel');
}
export {orderSettings};
