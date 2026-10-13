import fs from 'node:fs/promises';
for(const name of ['index.html','account.html']){
 const file=new URL(`../public/${name}`,import.meta.url);let html=await fs.readFile(file,'utf8');
 html=html.replace('<span class="brand-compact" aria-hidden="true"><img src="/assets/brand-compact.png" alt="" width="1246" height="701"></span>','<img class="footer-logo" src="/assets/icons/brand-logo-transparent.svg" alt="VS Market" width="730" height="110">');
 html=html.replace('<aside class="filters" aria-label="Фільтри каталогу">','<aside class="filters" id="catalog-filters" aria-label="Фільтри каталогу">');
 html=html.replace('aria-controls="filter-groups"','aria-controls="catalog-filters"');
 if(!html.includes('/assets/page-utilities.css'))html=html.replace('</head>','  <link rel="stylesheet" href="/assets/page-utilities.css?v=20261008-21">\n  <script src="/page-utilities.js?v=20261008-21" defer></script>\n</head>');
 html=html.replace(/\/app.js\?v=[\w-]+/g,'/app.js?v=20261009-22').replace(/\/page-utilities.js\?v=[\w-]+/g,'/page-utilities.js?v=20261009-22');
 await fs.writeFile(file,html);
}
console.log('Footer brand, back-to-top and mobile filters installed');
