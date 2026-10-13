import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const token=await localAdminToken(),api=(q,v={})=>localSaleor(q,v,token),check=r=>{if(r.errors?.length)throw new Error(JSON.stringify(r.errors));return r;};
const context=await api(`query{productTypes(first:100){edges{node{id slug variantAttributes{id}}}} attributes(first:100){edges{node{id externalReference}}}}`);
let type=context.productTypes.edges.map(e=>e.node).find(t=>t.slug==='vsmarket-models-variants');
if(!type)type=check((await api(`mutation($input:ProductTypeInput!){productTypeCreate(input:$input){productType{id slug variantAttributes{id}} errors{field code message}}}`,{input:{name:'Моделі VS Market з варіантами',slug:'vsmarket-models-variants',hasVariants:true,isShippingRequired:true,isDigital:false}})).productTypeCreate).productType;
const ops=context.attributes.edges.map(e=>e.node).filter(a=>a.externalReference?.startsWith('vsmarket-spec:')&&!type.variantAttributes.some(x=>x.id===a.id)).map(a=>({id:a.id,type:'VARIANT',variantSelection:false}));
if(ops.length)check((await api(`mutation($id:ID!,$ops:[ProductAttributeAssignInput!]!){productAttributeAssign(productTypeId:$id,operations:$ops){errors{field code message}}}`,{id:type.id,ops})).productAttributeAssign);
console.log(JSON.stringify({productType:type.slug,variantAttributes:ops.length}));
