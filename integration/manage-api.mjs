import {setProductActivation} from './product-activation.mjs';
import {loadInterest} from './customer-interest.mjs';
import {loadCustomers} from './manage-customers.mjs';
import {shopSettings,saveShopSettings,notificationSettings,saveNotificationSettings,discoverTelegram,uploadShopImage} from './shop-settings.mjs';
import {getProductEditor,editProduct} from './product-editor.mjs';
export function createManageApi({auth,orders,catalog,json,readBody,publicUrl,sourcePrice,sourceDescription,channel='vs-market-ua',dashboardUrl='http://127.0.0.1:9000/'}){
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/manage/'))return false;
  try{
   const action=url.pathname.slice('/api/manage/'.length);
   if(['settings','notification-settings','telegram-chats','shop-image'].includes(action)){
    if(!['GET','POST'].includes(req.method))throw Object.assign(new Error('Метод не підтримується.'),{status:405});
    await auth.requireStaff(req,res,action==='shop-image'?'MANAGE_PRODUCTS':'MANAGE_SETTINGS');
    if(req.method==='POST'){
     if(req.headers.origin!==new URL(publicUrl).origin)throw Object.assign(new Error('Запит має надходити з цього сайту.'),{status:403});
     if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Потрібен JSON-запит.'),{status:415});
     const body=await readBody(req);json(res,200,action==='shop-image'?await uploadShopImage(body):action==='settings'?await saveShopSettings(body):action==='telegram-chats'?await discoverTelegram():await saveNotificationSettings(body));
    }else json(res,200,action==='settings'?await shopSettings():action==='notification-settings'?await notificationSettings():{chats:[]});
    return true;
   }
   if(['activation','edit','order-status','order-settlement'].includes(action)){
    if(req.method!=='POST')throw Object.assign(new Error('Метод не підтримується.'),{status:405});
    if(!publicUrl||req.headers.origin!==new URL(publicUrl).origin)throw Object.assign(new Error('Запит має надходити з цього сайту.'),{status:403});
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Потрібен JSON-запит.'),{status:415});
    const account=await auth.requireStaff(req,res,action.startsWith('order-')?'MANAGE_ORDERS':'MANAGE_PRODUCTS');
    const body=await readBody(req);
    json(res,200,action==='order-settlement'?await orders.settle(body,account.user.id):action==='order-status'?await orders.setStatus(body,account.user.id):action==='activation'?await setProductActivation(account.graphql,channel,body):await editProduct(account.graphql,channel,body,sourcePrice,sourceDescription));return true;
   }
   if(req.method!=='GET')throw Object.assign(new Error('Метод не підтримується.'),{status:405});
   if(!['me','orders','catalog','product','interest','users'].includes(action))throw Object.assign(new Error('Не знайдено.'),{status:404});
   const account=await auth.requireStaff(req,res,['interest','users'].includes(action)?'MANAGE_USERS':action==='orders'?'MANAGE_ORDERS':['catalog','product'].includes(action)?'MANAGE_PRODUCTS':null);
   if(action==='users')json(res,200,await loadCustomers(account.graphql,account.permissions.includes('MANAGE_ORDERS')?await orders.list():null));
   if(action==='me')json(res,200,{user:account.user,canSettings:account.permissions.includes('MANAGE_SETTINGS'),canInterest:account.permissions.includes('MANAGE_USERS'),canOrders:account.permissions.includes('MANAGE_ORDERS'),canProducts:account.permissions.includes('MANAGE_PRODUCTS'),dashboardUrl});
   if(action==='interest')json(res,200,await loadInterest(account.graphql,account.permissions.includes('MANAGE_PRODUCTS')?await catalog(account):[]));
   if(action==='orders')json(res,200,{records:await orders.list()});
   if(action==='catalog')json(res,200,{products:await catalog(account)});
   if(action==='product')json(res,200,await getProductEditor(account.graphql,channel,{productId:url.searchParams.get('productId'),variantId:url.searchParams.get('variantId')},sourcePrice,sourceDescription));
  }catch(problem){json(res,problem.status||503,{error:problem.status?problem.message:'Не вдалося завантажити дані. Спробуйте ще раз.'});}
  return true;
 };
}
