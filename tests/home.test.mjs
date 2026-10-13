import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateCustomDesign,customLabels} from '../integration/custom-product.mjs';
test('home configurator updates a proportional sketch and sends selected dimensions to cart and catalog',async()=>{
 const source=await readFile(new URL('../public/home.js',import.meta.url),'utf8');
 const elements=new Map(),fields=new Map(),added=[];
 const element=key=>{if(!elements.has(key))elements.set(key,{value:'',hidden:false,textContent:'',attrs:{},listeners:{},setAttribute(key,value){this.attrs[key]=value},addEventListener(key,fn){this.listeners[key]=fn}});return elements.get(key)};
 for(const [key,value] of Object.entries({kind:'window',material:'pvc',width:'1200',height:'1400',color:'white',opening:'tilt-turn',sections:'2'})){
   const field=element('field '+key);field.value=value;
   Object.defineProperty(field,'innerHTML',{set(value){this.html=value;const match=/value="([^"]+)"/.exec(value);if(match)this.value=match[1]},get(){return this.html||''}});fields.set(key,field);
 }
 const form=element('#configurator-form');form.elements={namedItem:key=>fields.get(key)};
 const context=vm.createContext({location:{pathname:'/'},document:{querySelector:element},VSMarketShop:{labels:customLabels,normalizeDesign:validateCustomDesign,addCustomProduct:design=>added.push(design),catalogUrl:(category,q)=>'/catalog?'+new URLSearchParams({category,q})},fetch:async()=>({ok:true,json:async()=>({socials:[{label:'Facebook',url:'https://www.facebook.com/vsmarketua'},{label:'Instagram',url:'https://www.instagram.com/VSMARKET.UA'},{label:'TikTok',url:'https://www.tiktok.com/@vsmarket.ua'},{label:'Unsafe',url:'javascript:alert(1)'}]})}),URL,URLSearchParams});
 vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 const preview=element('#constructor-preview');assert.match(preview.innerHTML,/<svg/);assert.match(preview.innerHTML,/1200 мм/);assert.match(preview.innerHTML,/1400 мм/);
 fields.get('width').value='1000';fields.get('color').value='anthracite';form.listeners.input();
 assert.match(preview.innerHTML,/1000 мм/);assert.match(preview.innerHTML,/#3b4148/);assert.match(preview.attrs['aria-label'],/Антрацит/);
 const url=new URL(element('#constructor-ready').href,'http://localhost');assert.equal(url.pathname,'/catalog');assert.equal(url.searchParams.get('q'),'1000×1400');
 form.listeners.submit({preventDefault(){}});assert.equal(added.length,1);assert.equal(added[0].width,1000);assert.equal(added[0].color,'anthracite');
 fields.get('kind').value='door';form.listeners.change();assert.equal(fields.get('width').value,'900');assert.equal(fields.get('height').value,'2050');assert.equal(fields.get('material').value,'metal');assert.equal(fields.get('opening').value,'right');assert.equal(element('#constructor-sections-field').hidden,true);
 fields.get('opening').value='left';form.listeners.change();form.listeners.submit({preventDefault(){}});assert.equal(added[1].kind,'door');assert.equal(added[1].sections,1);assert.equal(added[1].opening,'left');
 fields.get('width').value='-5';form.listeners.input();assert.equal(element('#constructor-add').disabled,true);assert.equal(element('#constructor-ready').hidden,true);form.listeners.submit({preventDefault(){}});assert.equal(added.length,2);
 const socials=element('#social-links').innerHTML;assert.match(socials,/facebook.com\/vsmarketua/);assert.match(socials,/instagram.com\/VSMARKET.UA/);assert.match(socials,/tiktok.com\/@vsmarket.ua/);assert.doesNotMatch(socials,/javascript:/);assert.equal(element('#socials').hidden,false);
 for(const brand of ['facebook','instagram','tiktok'])assert.ok(socials.includes(`data-social-icon="${brand}"`));
});
