import fs from 'node:fs/promises';
const url=new URL('../public/app.js',import.meta.url);let source=await fs.readFile(url,'utf8');
source=source.replace("${productArt(product,'product-page-art')}","${productGallery(product)}");
const start=source.indexOf("${variants.length > 1 ? `<label class=\"variant-choice\">");
const end=source.indexOf("<p class=\"product-price\">",start);
if(start<0||end<0)throw new Error('Product controls anchor not found');
source=source.slice(0,start)+"${variants.length > 1 ? variantControls(variants,product) : ''}"+source.slice(end);
source=source.replace("if (event.target.id === 'product-variant-choice') location.assign(event.target.value);",`if (event.target.id === 'product-variant-choice') selectVariant(byId(event.target.value));
  if(event.target.dataset.variantAxis){
    const current=state.activeProduct,key=event.target.dataset.variantAxis;
    const candidates=state.products.filter(p=>p.productId===current.productId&&variantDimension(p,key)===event.target.value);
    const axes=['size','color','opening_direction'].filter(axis=>axis!==key);
    const score=p=>axes.filter(axis=>variantDimension(p,axis)===variantDimension(current,axis)).length;
    candidates.sort((a,b)=>score(b)-score(a)||(a.price??Infinity)-(b.price??Infinity));
    if(candidates.length)selectVariant(candidates[0]);
  }`);
source=source.replace("const add = event.target.closest('[data-add]');",`const photo=event.target.closest('[data-photo]');
  if(photo){const item=state.activeProduct?.media?.find(m=>m.id===photo.dataset.photo),image=$('.product-page-art img');if(item&&image){image.src=imageUrl(item.url);image.alt=item.alt;document.querySelectorAll('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',String(b===photo)));}return;}
  const add = event.target.closest('[data-add]');`);
await fs.writeFile(url,source);
