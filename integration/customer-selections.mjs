export const SELECTIONS_KEY='vsmarket:selections:v1';
export const SELECTION_FIELDS=`id metafield(key:"${SELECTIONS_KEY}")`;
const limits={favorites:250,comparison:4};
const problem=(message)=>Object.assign(new Error(message),{status:400});
const validId=id=>typeof id==='string'&&id.length>0&&id.length<200&&!/[\u0000-\u001f]/.test(id);
export function readSelections(value){
 let data;try{data=JSON.parse(value||'{}');}catch{data={};}
 const result={revision:Number.isSafeInteger(data.revision)?data.revision:0,favorites:[],comparison:[],applied:[]};
 for(const key of Object.keys(limits))if(Array.isArray(data[key]))result[key]=[...new Set(data[key].filter(validId))].slice(0,limits[key]);
 if(Array.isArray(data.applied))result.applied=data.applied.filter(validId).slice(-100);
 return result;
}
export function validateOperations(body){
 if(!validId(body.owner)||!Array.isArray(body.operations)||body.operations.length<1||body.operations.length>100)throw problem('Некоректні зміни списку.');
 return body.operations.map(op=>{
  if(!op||!validId(op.id))throw problem('Некоректна зміна списку.');
  if(op.type==='merge'){
   const clean={id:op.id,type:'merge'};
   for(const key of Object.keys(limits)){
    if(!Array.isArray(op[key])||op[key].length>limits[key]||!op[key].every(validId))throw problem('Список перевищує допустимий розмір.');
    clean[key]=[...new Set(op[key])];
   }
   return clean;
  }
  if(!['add','remove'].includes(op.type)||!Object.hasOwn(limits,op.list)||!validId(op.item))throw problem('Некоректна зміна списку.');
  return {id:op.id,type:op.type,list:op.list,item:op.item};
 });
}
export function applyOperations(saved,operations){
 const data=structuredClone(saved),overflow=[];
 for(const op of operations){
  if(data.applied.includes(op.id))continue;
  const add=(key,id)=>{if(data[key].includes(id))return;if(data[key].length>=limits[key]){overflow.push({list:key,item:id});return;}data[key].push(id);};
  if(op.type==='merge')for(const key of Object.keys(limits))for(const id of op[key])add(key,id);
  else if(op.type==='add')add(op.list,op.item);
  else data[op.list]=data[op.list].filter(id=>id!==op.item);
  data.applied.push(op.id);data.applied=data.applied.slice(-100);data.revision++;
 }
 return {data,overflow};
}
export function publicSelections(data){return {revision:data.revision,favorites:data.favorites,comparison:data.comparison};}
