export async function loadCustomers(graphql,records){
 const users=[];let after=null;
 do{
  const result=await graphql(`query ManageCustomers($after:String){customers(first:100,after:$after){edges{node{id email firstName lastName isActive dateJoined phone:metafield(key:"storefront_phone")}} pageInfo{hasNextPage endCursor}}}`,{after});
  if(!result.customers)throw new Error('Customers unavailable');
  users.push(...result.customers.edges.map(({node:u})=>({id:u.id,name:[u.firstName,u.lastName].filter(Boolean).join(' ')||u.email,email:u.email,phone:u.phone||'',active:u.isActive,joinedAt:u.dateJoined,...(records?{orders:records.filter(r=>r.order.customerId===u.id).map(({order:o})=>({id:o.id,createdAt:o.createdAt,status:o.status||'received',total:o.pricing?.total??o.lines.reduce((sum,l)=>sum+(l.unitPrice||0)*l.quantity,0)}))}:{})})));
  after=result.customers.pageInfo.hasNextPage?result.customers.pageInfo.endCursor:null;
 }while(after);
 return {users};
}
