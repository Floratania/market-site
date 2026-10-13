// Only explicitly published display values belong in the customer catalogue.
// Reference IDs, accounting fields and unresolved 1C composite values stay in the bridge.
const fields = [
  ['material', 'Матеріал'], ['opening', 'Вид відкривання'], ['opening_direction', 'Сторона відкривання'], ['color', 'Колір'],
  ['profile', 'Профіль'], ['product_type', 'Тип'], ['manufacturer', 'Виробник'],
  ['country', 'Країна походження'], ['width', 'Ширина'], ['height', 'Висота'],
  ['length', 'Довжина'], ['weight', 'Вага'], ['unit', 'Одиниця продажу'],
  ['warranty', 'Гарантія'],
];
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function specificationsFor(productMetadata = [], variantMetadata = []) {
  const combined = new Map();
  for (const [scope, metadata] of [['product', productMetadata], ['variant', variantMetadata]]) {
    const meta = new Map(metadata.map(item => [item.key, item.value]));
    for (const [key, label] of fields) {
      const value = clean(meta.get(key), 500);
      if (value) combined.set(key, { key, label, value, unit: clean(meta.get(`${key}_unit`), 30), filterable: !['weight', 'length', 'warranty', 'unit'].includes(key), scope });
    }
    let additional;
    try { additional = JSON.parse(meta.get('public_specs') || '[]'); } catch { additional = []; }
    if (!Array.isArray(additional)) continue;
    for (const item of additional.slice(0, 80)) {
      if (!item || typeof item !== 'object' || !/^[a-z][a-z0-9_-]{0,63}$/.test(item.key || '')) continue;
      const label = clean(item.label, 100), value = clean(item.value, 500);
      if (!label || !value) continue;
      combined.set(item.key, { key: item.key, label, value, unit: clean(item.unit, 30), filterable: item.filterable === true, scope });
    }
  }
  // Website edits override imported display fields, including an intentional blank.
  const override=(variantMetadata||[]).find(item=>item.key==='storefront_specs')?.value;
  let edited;try{edited=JSON.parse(override||'[]');}catch{edited=[];}
  if(Array.isArray(edited))for(const item of edited.slice(0,10)){
    if(!item||!['width','height','color','opening','opening_direction','construction_type','product_type'].includes(item.key))continue;
    const value=clean(item.value,500),label=clean(item.label,100);
    if(!value){combined.delete(item.key);continue;}
    if(label)combined.set(item.key,{key:item.key,label,value,unit:clean(item.unit,30),filterable:true,scope:'variant'});
  }
  return [...combined.values()];
}
