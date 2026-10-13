import crypto from 'node:crypto';
// Dimensions and handing vary within a model. Never strip profile names, glazing,
// design codes, quality notes or unknown words: those remain part of its identity.
export function modelIdentity(row,specs=[]){
 const name=row.Name.trim();
 const dimensions=/\(?\b\d{3,4}\s*[*xх×]\s*\d{3,4}\b\)?/gi;
 if(!dimensions.test(name)||/вияснити|неліквід|брак|уцін/i.test(name))return {name,key:`single:${row.ProductRef}`};
 dimensions.lastIndex=0;
 let base=name.replace(dimensions,' ').replace(/\b[RL]\b/g,' ');
 // These are explicit finish phrases found in the source catalogue, not a
 // wildcard matching arbitrary suffixes. Unknown finishes stay in the name.
 base=base.replace(/(?:зовні|зовн\.?|ззовні)\s*(?:піщаний\s+антрацит|золотий\s+дуб|горіх|дуб\s+монтана)/gi,' ');
 base=base.replace(/\bБілий\b/giu,' '); // Cyrillic boundaries are handled below.
 base=base.replace(/(^|\s)Білий(?=\s|$)/giu,' ');
 base=base.replace(/\bстандрат\b/giu,'стандарт').replace(/стандрат/giu,'стандарт');
 base=base.replace(/\s+/g,' ').trim();
 if(base.length<8)return {name,key:`single:${row.ProductRef}`};
 // The full retained name is the exact model key. Profile, glazing wording and
 // design codes remain in it; differences in source properties are variant data.
 const key=JSON.stringify([base.toLocaleLowerCase('uk')]);
 return {name:base,key};
}
export function groupModels(rows,enrichment){
 const specs=new Map(enrichment.products.map(p=>[p.productRef,p.specs]));
 const groups=new Map();
 for(const row of rows.filter(r=>r.Price!==null)){
  const identity=modelIdentity(row,specs.get(row.ProductRef)||[]);
  const group=groups.get(identity.key)||{key:identity.key,name:identity.name,members:[]};
  group.members.push({productRef:row.ProductRef,sku:row.Code.trim(),sourceName:row.Name,specs:specs.get(row.ProductRef)||[]});groups.set(identity.key,group);
 }
 return [...groups.values()].map(g=>({...g,id:crypto.createHash('sha256').update(g.key).digest('hex').slice(0,24)}));
}
