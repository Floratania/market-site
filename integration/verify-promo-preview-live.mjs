import {buildQuote} from './checkout-pricing.mjs';
const data=await(await fetch('http://127.0.0.1:8790/api/catalog')).json(),p=data.products.find(p=>p.availableTotal>1);
if(!p)throw new Error('No stock for promo verification');
try{await buildQuote({lines:[{sku:p.sku,quantity:1}],promoCode:'VS-INVALID-TEST-20261012'},[p]);throw new Error('Invalid code accepted');}catch(e){if(e.status!==400)throw e;console.log(JSON.stringify({invalidCodeRejected:true,message:e.message}));}
