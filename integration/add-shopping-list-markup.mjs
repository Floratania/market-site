import {readFile,writeFile} from 'node:fs/promises';
const heart='<svg class="selection-icon heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const compare='<svg class="selection-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m8 10V4m8 16V7M2 20h20"/></svg>';
for(const name of ['index.html','account.html']){
 const file=new URL('../public/'+name,import.meta.url);let html=await readFile(file,'utf8');
 html=html.replace('<img class="brand-logo" src="/logo.png" alt="VS Market">','<span class="brand-logo-frame"><img class="brand-logo" src="/logo.png" alt="VS Market"></span>');
 html=html.replace('/assets/brand-variants.css?v=20261008-4','/assets/brand-variants.css?v=20261008-7');
 if(!html.includes('shopping-lists.css'))html=html.replace('<link rel="stylesheet" href="/assets/fonts.css">','<link rel="stylesheet" href="/assets/fonts.css">\n  <link rel="stylesheet" href="/assets/shopping-lists.css?v=20261008-7">');
 if(!html.includes('class="shopping-tools"'))html=html.replace('  </header>',`  </header>\n  <nav class="shopping-tools" aria-label="Збережені товари">${name==='index.html'?`<button id="favorites-trigger" type="button">${heart}Улюблені <span class="list-count" id="favorites-count">0</span></button><button id="comparison-trigger" type="button">${compare}Порівняння <span class="list-count" id="comparison-count">0</span></button>`:`<a href="/?list=favorites#catalog">${heart}Улюблені</a><a href="/?list=comparison#catalog">${compare}Порівняння</a>`}</nav>`);
 if(name==='index.html'){
  html=html.replace('/app.js?v=20261008-5','/app.js?v=20261008-7');
  if(!html.includes('id="favorites-dialog"'))html=html.replace('  <dialog id="photo-viewer"',`  <p id="selection-status" class="selection-status" role="status" hidden></p>\n  <dialog id="favorites-dialog" class="shopping-dialog" aria-labelledby="favorites-title"><div class="shopping-dialog-head"><h2 id="favorites-title">Улюблені товари</h2><button type="button" data-close-list="favorites-dialog" aria-label="Закрити улюблені">✕</button></div><p class="shopping-dialog-note">Збережено в цьому браузері. Для іншої комплектації відкрийте сторінку моделі.</p><div id="favorites-content"></div></dialog>\n  <dialog id="comparison-dialog" class="shopping-dialog" aria-labelledby="comparison-title"><div class="shopping-dialog-head"><h2 id="comparison-title">Порівняння товарів</h2><button type="button" data-close-list="comparison-dialog" aria-label="Закрити порівняння">✕</button></div><p class="shopping-dialog-note">До 4 комплектацій. Ціна та характеристики відповідають зазначеному артикулу; остаточну ціну підтвердить менеджер.</p><label class="comparison-options"><input id="comparison-differences" type="checkbox">Лише відмінності</label><div id="comparison-content"></div></dialog>\n  <dialog id="photo-viewer"`);
 }
 await writeFile(file,html);
}
console.log('Brand frame, list navigation and dialogs added.');
