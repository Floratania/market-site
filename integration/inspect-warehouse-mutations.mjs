import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const token=await localAdminToken();
const data=await localSaleor('query{__type(name:"Mutation"){fields{name args{name type{kind name ofType{kind name ofType{kind name}}}}}}}',{},token);
console.log(JSON.stringify(data.__type.fields.filter(row=>/warehouse/i.test(row.name)),null,2));
