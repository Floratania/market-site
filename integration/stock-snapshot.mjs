import fs from 'node:fs/promises';
export async function stockSnapshot(file,skus){
 let snapshot;
 try{snapshot=JSON.parse(await fs.readFile(file,'utf8'));}catch{return {items:[],verified:false,snapshotAt:null};}
 const checkedAt=Date.parse(snapshot.updatedAt);
 if(!Array.isArray(snapshot.items)||!Number.isFinite(checkedAt)||checkedAt>Date.now()+30000)return {items:[],verified:false,snapshotAt:null};
 const requested=new Set(skus),seen=new Set();
 const items=[];
 for(const row of snapshot.items){
   if(!requested.has(row.sku))continue;
   const key=`${row.sku}:${row.location}`;
   if(!['mamaivtsi','magala'].includes(row.location)||!Number.isFinite(row.quantity)||row.quantity<0||seen.has(key))return {items:[],verified:false,snapshotAt:null};
   seen.add(key);items.push({sku:row.sku,location:row.location,quantity:row.quantity,updatedAt:snapshot.updatedAt});
 }
 return {items,verified:false,snapshotAt:snapshot.updatedAt};
}
