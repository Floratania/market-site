import crypto from 'node:crypto';
import {CART_KEY,readCart,applyCartChanges} from './customer-interest.mjs';
import {SELECTIONS_KEY,SELECTION_FIELDS,readSelections,validateOperations,applyOperations,publicSelections} from './customer-selections.mjs';

const USER_FIELDS='id email firstName lastName phone:metafield(key:"storefront_phone")';
const QUERIES={
 login:`mutation CustomerLogin($email:String!,$password:String!){tokenCreate(email:$email,password:$password){token refreshToken csrfToken user{${USER_FIELDS}} errors{code field}}}`,
 register:'mutation CustomerRegister($input:AccountRegisterInput!){accountRegister(input:$input){requiresConfirmation errors{code field}}}',
 me:`query CustomerMe{me{${USER_FIELDS}}}`,
 refresh:'mutation CustomerRefresh($refreshToken:String!,$csrfToken:String){tokenRefresh(refreshToken:$refreshToken,csrfToken:$csrfToken){token errors{code field}}}',
 confirm:'mutation CustomerConfirm($email:String!,$token:String!,$password:String){confirmAccount(email:$email,token:$token,password:$password){errors{code field}}}',
 reset:'mutation CustomerReset($email:String!,$redirectUrl:String!,$channel:String){requestPasswordReset(email:$email,redirectUrl:$redirectUrl,channel:$channel){errors{code field}}}',
 setPassword:'mutation CustomerSetPassword($email:String!,$token:String!,$password:String!){setPassword(email:$email,token:$token,password:$password){errors{code field}}}',
 update:`mutation CustomerUpdate($input:AccountInput!){accountUpdate(input:$input){user{${USER_FIELDS}} errors{code field}}}`,
 selections:`query CustomerSelections{me{${SELECTION_FIELDS}}}`,
 saveSelections:'mutation CustomerSelectionsSave($id:ID!,$input:[MetadataInput!]!){updateMetadata(id:$id,input:$input){errors{code field}}}',
 savePhone:'mutation CustomerPhoneSave($id:ID!,$input:[MetadataInput!]!){updateMetadata(id:$id,input:$input){errors{code field}}}',
};
const error=(status,message)=>Object.assign(new Error(message),{status});
function email(value){
 if(typeof value!=='string' || value.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw error(400,'Вкажіть коректну електронну адресу.');
 return value.trim().toLowerCase();
}
function password(value,{existing=false}={}){
 if(typeof value!=='string' || value.length>(existing?1024:128) || value.length<(existing?1:8))throw error(400,'Пароль має містити від 8 до 128 символів.');
 return value;
}
function names(body){
 const result={};
 for(const key of ['firstName','lastName']){
  if(typeof body[key]!=='string' || body[key].trim().length>80)throw error(400,'Перевірте ім’я та прізвище.');
  result[key]=body[key].trim();
 }
 if(!result.firstName)throw error(400,'Вкажіть ваше ім’я.');
 return result;
}
function accountError(result,{login=false}={}){
 const errors=result?.errors || [];
 if(!errors.length)return;
 if(errors.some(item=>item.code==='LOGIN_ATTEMPT_DELAYED'))throw error(429,'Вхід тимчасово призупинено після невдалої спроби. Зачекайте трохи та спробуйте знову.');
 if(login){
  if(errors.some(item=>item.code==='ACCOUNT_NOT_CONFIRMED'))throw error(401,'Спочатку підтвердьте електронну адресу за посиланням у листі.');
  throw error(401,'Неправильна електронна адреса або пароль.');
 }
 const code=errors[0].code;
 if(['PASSWORD_TOO_SHORT','PASSWORD_TOO_COMMON','PASSWORD_TOO_SIMILAR','PASSWORD_ENTIRELY_NUMERIC'].includes(code))throw error(400,'Оберіть складніший пароль: щонайменше 8 символів, літери й цифри.');
 if(['INVALID_TOKEN','EXPIRED','INVALID_CREDENTIALS'].includes(code) || errors.some(item=>item.field==='token' && item.code==='INVALID'))throw error(400,'Посилання недійсне або термін його дії минув.');
 if(code==='UNIQUE')throw error(409,'Ця адреса вже зареєстрована. Увійдіть або відновіть пароль.');
 throw error(400,'Не вдалося виконати дію. Перевірте введені дані.');
}
function safeUser(user){return user?Object.fromEntries(['id','email','firstName','lastName','phone'].map(key=>[key,user[key] || ''])):null;}
function phone(value){if(typeof value!=='string'||value.length>30)throw error(400,'Перевірте номер телефону.');const clean=value.replace(/[\s()-]/g,'');if(clean&&!/^\+?\d{10,15}$/.test(clean))throw error(400,'Вкажіть коректний номер телефону.');return clean;}
function jwtExpiry(token){
 try{return Number(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).exp)*1000 || 0;}catch{return 0;}
}

export function createCustomerAuth({saleorUrl,channel,publicUrl,json,readBody,fetchImpl=fetch,now=Date.now}){
 const site=new URL(publicUrl);
 if(!['http:','https:'].includes(site.protocol))throw new Error('Invalid storefront public URL');
 const cookieName='vs_market_session';
 const lifetime=24*3600*1000;
 const sessions=new Map(),attempts=new Map(),selectionWrites=new Map();
 const allowed=new Set(['me','login','register','logout','confirm','password-reset','password-set','profile','selections','cart']);
 const cookie=(res,id)=>res.setHeader('Set-Cookie',`${cookieName}=${id || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${id?lifetime/1000:0}${site.protocol==='https:'?'; Secure':''}`);
 const sessionId=req=>(req.headers.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1) || '';
 function prune(){
  for(const [id,session] of sessions)if(session.expires<=now())sessions.delete(id);
  for(const [key,attempt] of attempts)if(attempt.expires<=now())attempts.delete(key);
 }
 function throttle(req,action){
  prune();
  const key=`${req.socket.remoteAddress || 'unknown'}:${action}`;
  let attempt=attempts.get(key);
  if(!attempt){
   if(attempts.size>=10000)throw error(429,'Забагато спроб. Спробуйте пізніше.');
   attempt={count:0,expires:now()+15*60*1000};attempts.set(key,attempt);
  }
  if(++attempt.count>(['selections','cart'].includes(action)?600:action==='register' || action==='password-reset'?5:20))throw error(429,'Забагато спроб. Спробуйте через 15 хвилин.');
 }
 async function graphql(query,variables={},token){
  if(!saleorUrl)throw error(503,'Вхід і реєстрація тимчасово недоступні.');
  let response,payload;
  try{
   response=await fetchImpl(saleorUrl,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(10000)});
   payload=await response.json();
  }catch{throw error(503,'Сервіс облікових записів тимчасово недоступний.');}
  if(!response.ok)throw error(503,'Сервіс облікових записів тимчасово недоступний.');
  if(payload.errors?.length){
   if(payload.errors.some(item=>['JWT_EXPIRED','JWT_INVALID_TOKEN','JWT_INVALID','UNAUTHENTICATED'].includes(item.extensions?.exception?.code || item.extensions?.code)))throw error(401,'Увійдіть повторно.');
   throw error(503,'Сервіс облікових записів тимчасово недоступний.');
  }
  if(!payload.data)throw error(503,'Сервіс облікових записів тимчасово недоступний.');
  return payload.data;
 }
 function invalidate(req,res){sessions.delete(sessionId(req));cookie(res,null);}
 async function current(req,res){
  prune();const session=sessions.get(sessionId(req));
  if(!session)return null;
  try{
   if(jwtExpiry(session.token)<=now()+30000){
    if(!session.refreshToken)throw error(401,'Увійдіть повторно.');
    const data=await graphql(QUERIES.refresh,{refreshToken:session.refreshToken,csrfToken:session.csrfToken});
    if(!data.tokenRefresh?.token || data.tokenRefresh.errors?.length)throw error(401,'Увійдіть повторно.');
    session.token=data.tokenRefresh.token;
   }
   const data=await graphql(QUERIES.me,{},session.token);
   if(!data.me)throw error(401,'Увійдіть повторно.');
   return {session,user:safeUser(data.me)};
  }catch(problem){if(problem.status===401){invalidate(req,res);return null;}throw problem;}
 }
 async function handle(req,res,url){
  if(!url.pathname.startsWith('/api/auth/'))return false;
  const action=url.pathname.slice('/api/auth/'.length);
  try{
   if(!allowed.has(action))throw error(404,'Не знайдено.');
   if(action==='me'){
    if(req.method!=='GET')throw error(405,'Метод не підтримується.');
    const account=await current(req,res);json(res,200,{user:account?.user || null});return true;
   }
   if(action==='cart'&&req.method==='GET'){
    const account=await current(req,res);if(!account)throw error(401,'Увійдіть у свій кабінет.');
    const result=await graphql(`query CustomerCart{me{id metafield(key:"${CART_KEY}")}}`,{},account.session.token);
    if(result.me?.id!==account.user.id)throw error(401,'Увійдіть повторно.');
    json(res,200,{owner:account.user.id,...readCart(result.me.metafield)});return true;
   }
   if(action==='selections'&&req.method==='GET'){
    const account=await current(req,res);if(!account)throw error(401,'Увійдіть у свій кабінет.');
    const result=await graphql(QUERIES.selections,{},account.session.token);
    if(result.me?.id!==account.user.id)throw error(401,'Увійдіть повторно.');
    json(res,200,{owner:account.user.id,...publicSelections(readSelections(result.me.metafield))});return true;
   }
   if(req.method!=='POST')throw error(405,'Метод не підтримується.');
   // Mutations are browser requests from this configured storefront only.
   if(req.headers.origin!==site.origin)throw error(403,'Запит має надходити з цього сайту.');
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''))throw error(415,'Потрібен JSON-запит.');
   throttle(req,action);
   const body=await readBody(req);
   if(!body || typeof body!=='object' || Array.isArray(body))throw error(400,'Некоректні дані.');
   if(action==='logout'){invalidate(req,res);json(res,200,{ok:true});return true;}
   if(action==='cart'){
    const account=await current(req,res);if(!account)throw error(401,'Увійдіть у свій кабінет.');
    if(body.owner!==account.user.id)throw error(409,'Акаунт змінився. Оновіть сторінку.');
    const owner=account.user.id,key='cart:'+owner,previous=selectionWrites.get(key)||Promise.resolve();
    const write=previous.catch(()=>{}).then(async()=>{
     const current=await graphql(`query CustomerCart{me{id metafield(key:"${CART_KEY}")}}`,{},account.session.token);
     if(current.me?.id!==owner)throw error(401,'Увійдіть повторно.');
     const data={...applyCartChanges(readCart(current.me.metafield),body),updatedAt:new Date(now()).toISOString()};
     const result=await graphql(QUERIES.saveSelections,{id:owner,input:[{key:CART_KEY,value:JSON.stringify(data)}]},account.session.token);
     accountError(result.updateMetadata);if(!result.updateMetadata)throw error(503,'Не вдалося зберегти кошик.');return {owner,...data};
    });selectionWrites.set(key,write);try{json(res,200,await write);}finally{if(selectionWrites.get(key)===write)selectionWrites.delete(key);}return true;
   }
   if(action==='selections'){
    const account=await current(req,res);if(!account)throw error(401,'Увійдіть у свій кабінет.');
    const operations=validateOperations(body);
    // The cookie establishes ownership; a supplied ID can only reject a stale tab.
    if(body.owner!==account.user.id)throw error(409,'Акаунт змінився. Оновіть сторінку.');
    const owner=account.user.id,previous=selectionWrites.get(owner)||Promise.resolve();
    const write=previous.catch(()=>{}).then(async()=>{
     const result=await graphql(QUERIES.selections,{},account.session.token);
     if(result.me?.id!==owner)throw error(401,'Увійдіть повторно.');
     const saved=readSelections(result.me.metafield),{data,overflow}=applyOperations(saved,operations);
     if(data.revision!==saved.revision){
      const update=await graphql(QUERIES.saveSelections,{id:owner,input:[{key:SELECTIONS_KEY,value:JSON.stringify(data)}]},account.session.token);
      if(!update.updateMetadata||update.updateMetadata.errors?.length)throw error(503,'Не вдалося синхронізувати списки. Спробуйте ще раз.');
     }
     return {owner,...publicSelections(data),overflow};
    });
    selectionWrites.set(owner,write);
    try{json(res,200,await write);}finally{if(selectionWrites.get(owner)===write)selectionWrites.delete(owner);}
    return true;
   }
   if(action==='login'){
    const data=await graphql(QUERIES.login,{email:email(body.email),password:password(body.password,{existing:true})});
    accountError(data.tokenCreate,{login:true});
    if(!data.tokenCreate?.token || !data.tokenCreate.user)throw error(401,'Неправильна електронна адреса або пароль.');
    prune();if(sessions.size>=10000)throw error(503,'Вхід тимчасово недоступний.');
    sessions.delete(sessionId(req));const id=crypto.randomBytes(32).toString('base64url');
    sessions.set(id,{token:data.tokenCreate.token,refreshToken:data.tokenCreate.refreshToken,csrfToken:data.tokenCreate.csrfToken,expires:now()+lifetime});
    cookie(res,id);json(res,200,{user:safeUser(data.tokenCreate.user)});return true;
   }
   if(action==='register'){
    const input={...names(body),email:email(body.email),password:password(body.password),languageCode:'UK',channel,redirectUrl:new URL('/account/confirm',site).href};
    const data=await graphql(QUERIES.register,{input});accountError(data.accountRegister);
    if(!data.accountRegister)throw error(503,'Реєстрація тимчасово недоступна.');
    json(res,201,{requiresConfirmation:!!data.accountRegister.requiresConfirmation});return true;
   }
   if(action==='profile'){
    const account=await current(req,res);if(!account)throw error(401,'Увійдіть у свій кабінет.');
    const number=body.phone===undefined?undefined:phone(body.phone);
    const data=await graphql(QUERIES.update,{input:names(body)},account.session.token);accountError(data.accountUpdate);
    if(number!==undefined){const saved=await graphql(QUERIES.savePhone,{id:account.user.id,input:[{key:'storefront_phone',value:number}]},account.session.token);accountError(saved.updateMetadata);if(!saved.updateMetadata)throw error(503,'Не вдалося зберегти номер телефону.');}
    json(res,200,{user:safeUser({...data.accountUpdate.user,...(number!==undefined?{phone:number}:{})})});return true;
   }
   const variables={email:email(body.email)};
   if(action==='password-reset'){
    variables.channel=channel;variables.redirectUrl=new URL('/account/reset',site).href;
    const data=await graphql(QUERIES.reset,variables);
    // Do not disclose whether an account exists to password reset callers.
    if(data.requestPasswordReset?.errors?.some(item=>!['NOT_FOUND','INACTIVE'].includes(item.code)))accountError(data.requestPasswordReset);
    json(res,200,{ok:true});return true;
   }
   if(typeof body.token!=='string' || !body.token || body.token.length>2048)throw error(400,'Некоректне посилання.');
   variables.token=body.token;
   if(action==='confirm'){
    if(body.password)variables.password=password(body.password,{existing:true});
    const data=await graphql(QUERIES.confirm,variables);accountError(data.confirmAccount);
    json(res,200,{ok:true});return true;
   }
   variables.password=password(body.password);
   const data=await graphql(QUERIES.setPassword,variables);accountError(data.setPassword);
   invalidate(req,res);json(res,200,{ok:true});return true;
  }catch(problem){json(res,problem.status || 503,{error:problem.status?problem.message:'Сервіс облікових записів тимчасово недоступний.'});return true;}
 }
 async function requireStaff(req,res,permission){
  const account=await current(req,res);
  if(!account)throw error(401,'Увійдіть як адміністратор.');
  const data=await graphql(`query StaffMe{me{${USER_FIELDS} isStaff isActive restrictedAccessToChannels accessibleChannels{slug} userPermissions{code}}}`,{},account.session.token);
  const staff=data.me;
  if(!staff || staff.id!==account.user.id || !staff.isStaff || !staff.isActive)throw error(403,'Доступ лише для адміністратора магазину.');
  // Local orders belong to this channel; a channel-restricted staff account must also have access to it.
  if(staff.restrictedAccessToChannels && !staff.accessibleChannels?.some(item=>item.slug===channel))throw error(403,'Немає доступу до цього магазину.');
  const permissions=(staff.userPermissions||[]).map(item=>item.code);
  if(permission&&!permissions.includes(permission))throw error(403,'Недостатньо прав для цього розділу.');
  return {user:safeUser(staff),permissions,graphql:(query,variables)=>graphql(query,variables,account.session.token)};
 }
 async function requireUser(req,res){const account=await current(req,res);if(!account)throw error(401,'Увійдіть у свій кабінет.');return {user:account.user};}
 async function optionalUser(req,res){return (await current(req,res))?.user||null;}
 return {handle,requireStaff,requireUser,optionalUser};
}
