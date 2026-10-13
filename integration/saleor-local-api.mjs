import fs from 'node:fs/promises';
export const localSaleorUrl='http://127.0.0.1:8000/graphql/';
export async function localSaleor(query,variables={},token,clockRetry=0){
 const response=await fetch(localSaleorUrl,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
   body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(120000)});
 const result=await response.json();
 if(result.errors?.some(item=>item.message==='The token is not yet valid (iat)')&&clockRetry<5){
  await new Promise(resolve=>setTimeout(resolve,2000));return localSaleor(query,variables,token,clockRetry+1);
 }
 if(!response.ok||result.errors?.length)throw new Error(`Local Saleor GraphQL failed: ${result.errors?.map(item=>`${item.message} (${item.path?.join('.')||'query'})`).join('; ')||response.status}`);
 return result.data;
}
export async function localAdminToken(){
 const credentials=JSON.parse(await fs.readFile(new URL('../saleor-admin.local.json',import.meta.url),'utf8'));
 const data=await localSaleor('mutation($email:String!,$password:String!){tokenCreate(email:$email,password:$password){token errors{code} user{isStaff}}}',{email:credentials.email,password:credentials.password});
 if(data.tokenCreate.errors.length||!data.tokenCreate.token||!data.tokenCreate.user?.isStaff)throw new Error('Local admin authentication failed; credentials are not logged');
 return data.tokenCreate.token;
}
