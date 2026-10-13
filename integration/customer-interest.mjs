export const CART_KEY='vsmarket:cart:v1';
export function cleanCart(lines){
 if(!Array.isArray(lines)||lines.length>250)throw Object.assign(new Error('Некоректний кошик.'),{status:400});
 const seen=new Set();return lines.map(line=>{
  if(!line||typeof line.id!=='string'||!line.id||line.id.length>200||seen.has(line.id)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>999)throw Object.assign(new Error('Некоректний кошик.'),{status:400});
  seen.add(line.id);return {id:line.id,quantity:line.quantity};
 });
}
export function readCart(raw){try{const data=JSON.parse(raw||'{}');return {lines:cleanCart(data.lines||[]),custom:data.custom||{},updatedAt:data.updatedAt||null};}catch{return {lines:[],custom:{},updatedAt:null};}}
export function applyCartChanges(saved,body){
 const incoming=cleanCart(body.lines),base=cleanCart(body.base||[]),map=new Map(saved.lines.map(l=>[l.id,l.quantity]));
 if(body.merge){for(const l of incoming)map.set(l.id,Math.max(map.get(l.id)||0,l.quantity));}
 else{const before=new Map(base.map(l=>[l.id,l.quantity])),after=new Map(incoming.map(l=>[l.id,l.quantity]));for(const id of new Set([...before.keys(),...after.keys()]))if(before.get(id)!==after.get(id)){if(after.has(id))map.set(id,after.get(id));else map.delete(id);}}
 const custom={...saved.custom};
 if(body.custom!==undefined){
  if(!body.custom||typeof body.custom!=='object'||Array.isArray(body.custom)||JSON.stringify(body.custom).length>80000||Object.keys(body.custom).length>50)throw Object.assign(new Error('Некоректний індивідуальний кошик.'),{status:400});
  for(const [id,item] of Object.entries(body.custom)){if(!/^custom-[a-z0-9-]{1,80}$/.test(id)||!Number.isInteger(item?.quantity)||item.quantity<1||item.quantity>999||!item.design||typeof item.design!=='object')throw Object.assign(new Error('Некоректний індивідуальний кошик.'),{status:400});}
  if(!body.merge)for(const id of Object.keys(body.baseCustom||{}))if(!Object.hasOwn(body.custom,id))delete custom[id];
  for(const [id,item] of Object.entries(body.custom))if(body.merge||JSON.stringify(item)!==JSON.stringify(body.baseCustom?.[id]))custom[id]=item;
 }
 return {lines:cleanCart([...map].map(([id,quantity])=>({id,quantity}))),custom};
}
export function interestReport(customers,products){
 const index=new Map(products.map(p=>[p.id,p])),ranking=new Map();
 const customersView=customers.map(user=>{
  let favorites=[];try{favorites=[...new Set(JSON.parse(user.selections||'{}').favorites||[])].filter(id=>typeof id==='string');}catch{}
  const cart=readCart(user.cart);
  const describe=(id,quantity)=>{const p=index.get(id);return {id,quantity,name:p?.name||'Товар недоступний',variantName:p?.variantName||'',sku:p?.sku||'',productId:p?.productId||null,price:p?.price??null};};
  for(const id of new Set([...favorites,...cart.lines.map(l=>l.id)])){
   const row=ranking.get(id)||{...describe(id),favorites:0,carts:0,quantity:0,customers:0};row.customers++;if(favorites.includes(id))row.favorites++;
   const line=cart.lines.find(l=>l.id===id);if(line){row.carts++;row.quantity+=line.quantity;}ranking.set(id,row);
  }
  return {id:user.id,name:[user.firstName,user.lastName].filter(Boolean).join(' ')||user.email,email:user.email,favorites:favorites.map(id=>describe(id)),cart:cart.lines.map(l=>describe(l.id,l.quantity)),updatedAt:cart.updatedAt};
 });
 return {updatedAt:new Date().toISOString(),registered:customers.length,withFavorites:customersView.filter(u=>u.favorites.length).length,withCart:customersView.filter(u=>u.cart.length).length,ranking:[...ranking.values()].sort((a,b)=>b.customers-a.customers||b.carts-a.carts||a.name.localeCompare(b.name,'uk')),customers:customersView.filter(u=>u.favorites.length||u.cart.length)};
}
export async function loadInterest(graphql,products){
 const users=[];let after=null;
 do{
  const result=await graphql(`query CustomerInterest($after:String){customers(first:100,after:$after){edges{node{id email firstName lastName selections:metafield(key:"vsmarket:selections:v1") cart:metafield(key:"${CART_KEY}")}} pageInfo{hasNextPage endCursor}}}`,{after});
  if(!result.customers)throw new Error('Customers unavailable');users.push(...result.customers.edges.map(e=>e.node));
  after=result.customers.pageInfo.hasNextPage?result.customers.pageInfo.endCursor:null;
 }while(after);
 return interestReport(users,products);
}
