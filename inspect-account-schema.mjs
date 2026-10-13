const query=`query {
 register: __type(name:"AccountRegisterInput") {inputFields{name type{kind name ofType{kind name}}}}
 login: __type(name:"CreateToken") {fields{name}}
 refresh: __type(name:"RefreshToken") {fields{name}}
 mutations: __type(name:"Mutation") {fields{name args{name type{kind name ofType{kind name}}}}}
 shopType: __type(name:"Shop") {fields{name}}
}`;
const response=await fetch('http://127.0.0.1:8000/graphql/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(20000)});
const result=await response.json();
if(result.errors)throw new Error('Account schema inspection failed');
result.data.mutations.fields=result.data.mutations.fields.filter(field=>['tokenCreate','tokenRefresh','confirmAccount','requestPasswordReset','setPassword','accountUpdate'].includes(field.name));
result.data.shopType.fields=result.data.shopType.fields.filter(field=>/confirm|password/i.test(field.name));
console.log(JSON.stringify(result.data,null,2));
