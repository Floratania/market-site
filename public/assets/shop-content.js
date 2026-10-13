fetch('/api/site',{cache:'no-store'}).then(r=>r.json()).then(({settings:s,socials})=>{
 if(!s)return;
 for(const a of document.querySelectorAll('a[href="tel:+380666709777"]')){a.href='tel:'+s.phone.replace(/[^+\d]/g,'');const label=a.querySelector('strong');if(label)label.textContent=s.phone;}
 for(const a of document.querySelectorAll('a[href="mailto:info@vstmarket.com.ua"]')){a.href='mailto:'+s.email;const label=a.querySelector('strong');if(label)label.textContent=s.email;}
 const title=document.querySelector('#hero-title');if(title)title.textContent=s.heroTitle;
 const text=document.querySelector('.hero-copy > p');if(text)text.textContent=s.heroText;
 const hero=document.querySelector('.hero-photo');if(hero&&s.heroImage)hero.src=s.heroImage;
 for(const [category,key] of [['Вікна','windowImage'],['Двері','doorImage'],['Допи','extrasImage']]){const photo=document.querySelector('.category-showcase [data-browse="'+category+'"] .category-photo');if(photo&&s[key])photo.src=s[key];}
 for(const a of document.querySelectorAll('.footer-social-links a')){const name=a.querySelector('span')?.textContent,url=socials.find(s=>s.label===name)?.url;if(url){a.href=url;a.hidden=false;}else a.hidden=true;}
}).catch(()=>{});
