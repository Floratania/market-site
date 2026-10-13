import fs from 'node:fs/promises';
import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const token=await localAdminToken();
const names=['AttributeCreateInput','AttributeInputTypeEnum','AttributeValueInput','AttributeValueCreateInput','ProductInput','ProductMediaCreateInput','ProductTypeAttributeAssign','AttributeTypeEnum','AttributeUnitEnum'];
const data=await localSaleor(`query{${names.map((name,i)=>`t${i}:__type(name:"${name}"){name kind enumValues{name} inputFields{name type{kind name ofType{kind name ofType{kind name}}}}}`).join('\n')} mutation:__type(name:"Mutation"){fields{name args{name type{kind name ofType{kind name ofType{kind name}}}}}}}`,{},token);
data.mutation.fields=data.mutation.fields.filter(f=>/attribute(Create|ValueCreate)|productTypeAttributeAssign|productMedia(Create|Reorder)|productUpdate/.test(f.name));
await fs.writeFile(new URL('enrichment-api-schema.local.json',import.meta.url),JSON.stringify(data,null,2));
console.log(JSON.stringify(data,null,2));
