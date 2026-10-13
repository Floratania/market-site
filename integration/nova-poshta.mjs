const endpoint = 'https://api.novaposhta.ua/v2.0/json/';
const refPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const cache = new Map();
export function validRef(value) { return typeof value === 'string' && refPattern.test(value); }
export async function novaRequest(method, properties, config = {}, fetchImpl = fetch) {
  const key = `${method}:${JSON.stringify(properties)}:${Boolean(config.apiKey)}`;
  const saved = cache.get(key);
  if(saved && saved.until > Date.now()) return saved.rows;
  const response = await fetchImpl(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({apiKey:config.apiKey || '',modelName:'Address',calledMethod:method,methodProperties:properties}),signal:AbortSignal.timeout(10000)});
  const data = await response.json();
  if(!response.ok || data.success !== true || !Array.isArray(data.data)) throw Object.assign(new Error('Довідник Нової пошти тимчасово недоступний. Вкажіть місто та відділення вручну.'), {status:503});
  if(cache.size > 300) cache.clear();
  cache.set(key, {until:Date.now()+15*60*1000,rows:data.data});
  return data.data;
}
export async function novaCities(query, config, fetchImpl) {
  const q = String(query || '').trim();
  if(q.length < 2 || q.length > 80) return [];
  const rows = await novaRequest('getCities',{FindByString:q,Limit:'30',Page:'1'},config,fetchImpl);
  return rows.filter(row=>validRef(row.Ref)).slice(0,30).map(row=>({ref:row.Ref,name:row.Description || row.DescriptionRu,label:[row.Description,row.AreaDescription].filter(Boolean).join(', ')}));
}
export async function novaWarehouses(cityRef, query, config, fetchImpl) {
  if(!validRef(cityRef)) throw Object.assign(new Error('Оберіть місто'),{status:400});
  const q=String(query || '').trim();
  if(q.length>80) throw Object.assign(new Error('Завеликий запит'),{status:400});
  const rows=await novaRequest('getWarehouses',{CityRef:cityRef,FindByString:q,Limit:'100',Page:'1',Language:'UA'},config,fetchImpl);
  return rows.filter(row=>validRef(row.Ref)).slice(0,100).map(row=>({ref:row.Ref,cityRef:row.CityRef,name:row.Description,number:row.Number,maxWeight:Number(row.TotalMaxWeightAllowed)||null,type:row.TypeOfWarehouse}));
}
export async function validateNovaDelivery(input, config, fetchImpl) {
  if(!input || !['branch','address'].includes(input.kind)) throw Object.assign(new Error('Оберіть спосіб доставки Новою поштою'),{status:400});
  const text=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):'';
  const city=text(input.city);
  if(city.length<2) throw Object.assign(new Error('Вкажіть населений пункт'),{status:400});
  if(input.kind==='address') {
    const street=text(input.street),house=text(input.house,30),apartment=text(input.apartment,30);
    if(street.length<2||!house)throw Object.assign(new Error('Вкажіть вулицю та номер будинку'),{status:400});
    return {carrier:'nova_poshta',kind:'address',city,street,house,apartment,verified:false};
  }
  const warehouse=text(input.warehouse);
  if(warehouse.length<2)throw Object.assign(new Error('Вкажіть відділення Нової пошти'),{status:400});
  if(input.cityRef || input.warehouseRef) {
    if(!validRef(input.cityRef)||!validRef(input.warehouseRef))throw Object.assign(new Error('Оберіть місто й відділення повторно'),{status:400});
    const rows=await novaRequest('getWarehouses',{Ref:input.warehouseRef,CityRef:input.cityRef,Limit:'1',Language:'UA'},config,fetchImpl);
    const row=rows.find(item=>item.Ref===input.warehouseRef&&item.CityRef===input.cityRef);
    if(!row)throw Object.assign(new Error('Відділення не належить обраному місту'),{status:400});
    return {carrier:'nova_poshta',kind:'branch',city:row.CityDescription||city,cityRef:input.cityRef,warehouse:row.Description,warehouseRef:row.Ref,verified:true,maxWeight:Number(row.TotalMaxWeightAllowed)||null};
  }
  return {carrier:'nova_poshta',kind:'branch',city,warehouse,verified:false};
}
