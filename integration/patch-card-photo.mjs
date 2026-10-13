import fs from 'node:fs/promises';
const url=new URL('../public/app.js',import.meta.url);let source=await fs.readFile(url,'utf8');
const start=source.indexOf('function card(product)'),end=source.indexOf('function renderCatalog()',start);let card=source.slice(start,end);
if(!card.includes('<article class="product-card"><a')||!card.includes('</a><div class="product-body">'))throw new Error('Card image anchors missing');
card=card.replace('<article class="product-card"><a','<article class="product-card"><div class="product-card-media"><a');
card=card.replace('</a><div class="product-body">','</a>${imageUrl(product.cardImage||product.image)?`<button type="button" class="card-photo-enlarge" data-enlarge="${escapeHtml(product.cardPhotoId||product.id)}" aria-label="Збільшити фото ${escapeHtml(product.name)}" title="Збільшити фото">⤢</button>`:\'\'}</div><div class="product-body">');
source=source.slice(0,start)+card+source.slice(end);
source=source.replace("cardImage:variants.find(p=>p.image)?.image||''","cardImage:variants.find(p=>p.image)?.image||'',cardPhotoId:variants.find(p=>p.image)?.id||first.id");
await fs.writeFile(url,source);
