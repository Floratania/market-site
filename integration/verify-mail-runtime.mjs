import {getMailer} from './order-notifications.mjs';
const mailer=await getMailer();
const transport=mailer.createTransport({streamTransport:true,buffer:true});
const result=await transport.sendMail({from:'shop@example.com',to:'owner@example.com',subject:'VS Market — test',text:'Offline runtime verification'});
if(!Buffer.isBuffer(result.message)||!result.message.includes(Buffer.from('Offline runtime verification')))throw new Error('Mail runtime failed');
console.log('Mail runtime ready. Offline verification passed; no email sent.');
