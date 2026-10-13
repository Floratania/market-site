import {localSaleor,localAdminToken} from './saleor-local-api.mjs';
const token=await localAdminToken();
const data=await localSaleor(`query{mutation:__type(name:"Mutation"){fields{name args{name type{kind name ofType{kind name ofType{kind name}}}}}} assign:__type(name:"ProductAttributeAssignInput"){inputFields{name type{kind name ofType{kind name}}}} units:__type(name:"MeasurementUnitsEnum"){enumValues{name}}}`,{},token);
data.mutation.fields=data.mutation.fields.filter(f=>/attribute.*assign/i.test(f.name));data.units.enumValues=data.units.enumValues.filter(v=>/MM|MILL/.test(v.name));console.log(JSON.stringify(data,null,2));
