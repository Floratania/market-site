const base='http://127.0.0.1:8790';
const checkout=await(await fetch(base+'/checkout')).text();
if(!checkout.includes('name="paymentMethod"')||!checkout.includes('id="order-promo"')||!checkout.includes('id="proposal-button"'))throw new Error('Checkout UI fields missing');
const proposal=await(await fetch(base+'/proposal')).text();if(!proposal.includes('id="proposal-page"')||!proposal.includes('proposal.js'))throw new Error('Proposal route missing');
const catalog=await(await fetch(base+'/api/catalog')).json(),p=catalog.products.find(p=>p.availableTotal>2&&p.image);
const response=await fetch(base+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({lines:[{sku:p.sku,quantity:2,unitPrice:1}]})}),quote=await response.json();
if(!response.ok||quote.total!==p.price*2||quote.lines[0].unitPrice!==p.price||quote.lines[0].image!==p.image)throw new Error('Quote totals or SKU photo mismatch');
const cfg=await(await fetch(base+'/api/checkout')).json();if(cfg.cardEnabled!==false||!cfg.paymentMethods.bank_transfer)throw new Error('Payment setup mismatch');
console.log(JSON.stringify({checkoutFields:true,proposalPage:true,serverPrices:true,quoteTotal:quote.total,cardEnabled:cfg.cardEnabled,ordersCreated:0}));
