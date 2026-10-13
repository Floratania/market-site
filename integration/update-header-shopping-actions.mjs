import fs from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const cartIcon='<svg class="selection-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3h2l3 12h11l2-9H6M8 15l-1 3h13"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>';
const exitIcon='<svg class="selection-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4"/></svg>';
for(const file of ['index.html','account.html']){
 const target=new URL(file,root);let html=await fs.readFile(target,'utf8');
 if(file==='index.html')html=html.replace(/    <button class="cart-trigger"[^\n]+\n/,'');
 const cart=file==='index.html'?`<button class="cart-trigger" id="cart-trigger" type="button" aria-label="Відкрити кошик" title="Кошик">${cartIcon}<span class="saved-label">Кошик</span><span class="list-count" id="cart-count">0</span></button>`:`<a class="cart-trigger" href="/catalog?cart=1" aria-label="Відкрити кошик" title="Кошик">${cartIcon}<span class="saved-label">Кошик</span><span class="list-count" id="cart-count">0</span></a>`;
 html=html.replace(/(<div class="shopping-tools"[^\n]+)(<\/div>)/,`$1${cart}$2`);
 html=html.replace(/    (<a class="account-trigger"[^\n]+<\/a>)/,`    <div class="account-actions">$1<button class="account-trigger header-logout" id="header-logout" type="button" aria-label="Вийти з акаунта" title="Вийти з акаунта" hidden>${exitIcon}<span>Вийти</span></button></div>`);
 html=html.replaceAll('?v=20261008-14','?v=20261008-15');
 await fs.writeFile(target,html);
}
