import fs from 'node:fs/promises';
for(const file of ['index.html','account.html']){
 const path=new URL('../public/'+file,import.meta.url);let html=await fs.readFile(path,'utf8');
 const toolbar=html.match(/  <nav class="shopping-tools"[^\n]+/)[0];
 let headerToolbar=toolbar.replace('<nav class="shopping-tools"','<div class="shopping-tools" role="group"').replace('</nav>','</div>');
 headerToolbar=headerToolbar.replace('>Улюблені','><span class="saved-label">Улюблені</span>').replace('>Порівняння','><span class="saved-label">Порівняння</span>');
 if(file==='account.html')headerToolbar=headerToolbar.replace('</span></a><a','</span> <span class="list-count" id="favorites-count">0</span></a><a').replace('</span></a></div>','</span> <span class="list-count" id="comparison-count">0</span></a></div>');
 headerToolbar=headerToolbar.replace('id="favorites-trigger"','id="favorites-trigger" aria-label="Улюблені товари" title="Улюблені товари"').replace('id="comparison-trigger"','id="comparison-trigger" aria-label="Порівняння товарів" title="Порівняння товарів"');
 headerToolbar=headerToolbar.replace('href="/catalog?list=favorites#catalog"','href="/catalog?list=favorites#catalog" aria-label="Улюблені товари" title="Улюблені товари"').replace('href="/catalog?list=comparison#catalog"','href="/catalog?list=comparison#catalog" aria-label="Порівняння товарів" title="Порівняння товарів"');
 html=html.replace(toolbar+'\n','').replace('    <a class="account-trigger"',headerToolbar+'\n    <a class="account-trigger"');
 html=html.replace(/\?v=20261008-\d+/g,'?v=20261008-13');
 html=html.replace('  <script src="/'+(file==='index.html'?'app.js':'account-session.js'),'  <script src="/customer-selections.js?v=20261008-13" defer></script>\n  <script src="/'+(file==='index.html'?'app.js':'account-session.js'));
 html=html.replace('Збережено в цьому браузері. Для іншої комплектації відкрийте сторінку моделі.','Збережено на цьому пристрої. Увійдіть, щоб синхронізувати вибір між пристроями.');
 if(file==='index.html')html=html.replace('<p class="shopping-dialog-note">Збережено','<p class="shopping-dialog-note" data-selection-sync>Збережено');
 await fs.writeFile(path,html);
}
