import fs from 'node:fs/promises';
const truck='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h11v12H3zM14 9h4l3 4v4h-7M3 17H2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
for(const name of ['index.html','account.html']){
 const file=new URL(`../public/${name}`,import.meta.url);let html=await fs.readFile(file,'utf8');
 if(name==='index.html'&&!html.includes('home-ready-delivery'))html=html.replace('<p class="home-ready-note" id="home-ready-note"></p>',`<p class="home-ready-delivery">${truck}<span>Відправляємо Новою поштою по Україні</span></p><p class="home-ready-note" id="home-ready-note"></p>`);
 const contact='Дзвінок, email або соцмережі — оберіть, як вам зручно.';
 if(!html.includes('footer-delivery-note'))html=html.replace(contact+'</p>',contact+'</p><p class="footer-delivery-note">Відправляємо Новою поштою по Україні. Деталі доставки узгодимо під час підтвердження замовлення.</p>');
 html=html.replace(/\/app.js\?v=[\w-]+/g,'/app.js?v=20261009-22').replace(/\/home-discovery.js\?v=[\w-]+/g,'/home-discovery.js?v=20261009-22').replace(/\/assets\/discovery.css\?v=[\w-]+/g,'/assets/discovery.css?v=20261009-22');
 await fs.writeFile(file,html);
}
console.log('Product photos fit fully; delivery copy added; source system removed from customer copy');
