export const zeroRef = '0x00000000000000000000000000000000';
export function canonicalRef(value) {
  if (!/^0x[0-9a-f]{32}$/i.test(value || '')) throw new Error('Invalid 1C reference');
  return `0x${value.slice(2).toUpperCase()}`;
}
export function buildExport(products, variants, prices, priceType, asOf) {
  const productRefs = new Set();
  for (const row of products) {
    row.ProductRef = canonicalRef(row.ProductRef);
    if (productRefs.has(row.ProductRef)) throw new Error('Duplicate product reference');
    productRefs.add(row.ProductRef);
  }
  const pairs = new Set();
  for (const row of variants) {
    row.ProductRef=canonicalRef(row.ProductRef);row.VariantRef=canonicalRef(row.VariantRef);
    if (!productRefs.has(row.ProductRef) || row.VariantRef === zeroRef) throw new Error('Invalid variant owner');
    const pair=`${row.ProductRef}:${row.VariantRef}`;
    if (pairs.has(pair)) throw new Error('Duplicate variant reference');
    pairs.add(pair);
  }
  const issues=[];
  const pricePairs=new Set();
  const mapped=prices.map(row=>{
    const productRef=canonicalRef(row.ProductRef),variantRef=canonicalRef(row.VariantRef);
    const pair=`${productRef}:${variantRef}`;
    if (!productRefs.has(productRef) || pricePairs.has(pair)) throw new Error('Invalid or duplicate price reference');
    pricePairs.add(pair);
    const reasons=[];
    if(variantRef!==zeroRef && !pairs.has(pair)) reasons.push('unknown-or-inactive-variant');
    if(!row.IsActual) reasons.push('not-actual');
    if(Number(row.SamePeriodRows)!==1) reasons.push('ambiguous-latest-record');
    if(!/^\d+(?:\.\d+)?$/.test(String(row.Amount)) || Number(row.Amount)<=0) reasons.push('non-positive-or-invalid-price');
    if(reasons.length)issues.push({productRef,variantRef,reasons});
    return {...row,ProductRef:productRef,VariantRef:variantRef,PriceType:priceType.Name,
      CurrencyCode:priceType.CurrencyCode,CurrencyName:priceType.CurrencyName,IncludesVAT:priceType.IncludesVAT,
      Status:reasons.length?'review':'candidate'};
  });
  const priceMap=new Map(mapped.map(row=>[`${row.ProductRef}:${row.VariantRef}`,row]));
  const catalogRows=products.flatMap(product=>{
    const owned=variants.filter(row=>row.ProductRef===product.ProductRef);
    return [{...product,VariantRef:zeroRef,VariantName:''},...owned.map(variant=>({...product,
      VariantRef:variant.VariantRef,VariantName:variant.Name,VariantCode:variant.Code,
      VariantArticle:variant.Article,VariantWidthRaw:variant.WidthRaw,VariantHeightRaw:variant.HeightRaw,
      Color:variant.Color,Profile:variant.Profile,VariantType:variant.VariantType}))].map(row=>{
      const price=priceMap.get(`${row.ProductRef}:${row.VariantRef}`);
      return {...row,PriceType:priceType.Name,Currency:priceType.CurrencyName,IncludesVAT:priceType.IncludesVAT,
        Price:price?.Status==='candidate'?price.Amount:null,
        PriceStatus:price?price.Status:'missing',PricePeriodLocal:price?.PeriodLocal??null,
        PriceIncludesVariants:price?.IncludesVariants??null,PriceUnitRef:price?.UnitRef??null,
        PriceUnitReferenceType:price?.UnitReferenceType??null};
    });
  });
  const pricedProducts=new Set(mapped.filter(row=>row.Status==='candidate').map(row=>row.ProductRef));
  return {
    schemaVersion:1,exportedAt:new Date().toISOString(),asOf,
    scope:'1C windows and doors staging export; not published to Saleor',
    priceType,products,variants,prices:mapped,catalogRows,issues,
    summary:{products:products.length,variants:variants.length,prices:mapped.length,
      candidatePrices:mapped.filter(p=>p.Status==='candidate').length,priceIssues:issues.length,
      productsWithAnyPrice:pricedProducts.size,productsWithoutAnyPrice:products.length-pricedProducts.size,
      catalogRows:catalogRows.length,rowsWithoutExactPrice:catalogRows.filter(row=>row.Price===null).length},
    rules:{missingPrice:'null, never zero',variantPrice:'exact pair only; no automatic base-price inheritance',
      dimensions:'raw source values; units not inferred',stock:'not included',
      time:'asOf and PeriodLocal are SQL/1C local wall time, not UTC'}
  };
}
export function csv(rows, columns) {
  const cell=value=>{
    let text=value==null?'':String(value);
    // Excel must treat values such as =HYPERLINK(...) and leading + as text.
    if(/^[\s]*[=+@-]/.test(text))text=`'${text}`;
    return `"${text.replaceAll('"','""')}"`;
  };
  return '\uFEFF'+[columns.map(cell).join(';'),...rows.map(row=>columns.map(key=>cell(row[key])).join(';'))].join('\r\n')+'\r\n';
}

export function applyStockFilter(payload, stocks, onlyInStock = true) {
  const warehouses={'26-000004':'Mamaivtsi','26-000005':'Magala'};
  const knownProducts=new Set(payload.products.map(row=>row.ProductRef));
  const byPair=new Map(),seen=new Set();
  const checked=stocks.map(source=>{
    const row={...source,ProductRef:canonicalRef(source.ProductRef),VariantRef:canonicalRef(source.VariantRef)};
    if(!knownProducts.has(row.ProductRef)||!warehouses[row.WarehouseCode])throw new Error('Stock scope mismatch');
    if(!/^-?\d+(?:\.\d+)?$/.test(String(row.Available))||!/^-?\d+(?:\.\d+)?$/.test(String(row.Reserved)))throw new Error('Invalid stock quantities');
    const pair=`${row.ProductRef}:${row.VariantRef}`,key=`${pair}:${row.WarehouseCode}`;
    if(seen.has(key))throw new Error('Duplicate stock key');
    seen.add(key);
    const quantities=byPair.get(pair)||{};
    quantities[`Available${warehouses[row.WarehouseCode]}`]=row.Available;
    quantities[`Reserved${warehouses[row.WarehouseCode]}`]=row.Reserved;
    byPair.set(pair,quantities);
    return row;
  });
  const positive=new Set(checked.filter(row=>Number(row.Available)>0).map(row=>row.ProductRef));
  const originalSummary={...payload.summary};
  const allRows=payload.catalogRows.map(row=>({...row,
    AvailableMamaivtsi:'0',ReservedMamaivtsi:'0',AvailableMagala:'0',ReservedMagala:'0',
    ...byPair.get(`${row.ProductRef}:${row.VariantRef}`)}));
  const hasStock=row=>Number(row.AvailableMamaivtsi)>0||Number(row.AvailableMagala)>0;
  const included=onlyInStock?positive:knownProducts;
  const catalogRows=onlyInStock?allRows.filter(hasStock):allRows;
  const includedPairs=new Set(catalogRows.map(row=>`${row.ProductRef}:${row.VariantRef}`));
  const knownPairs=new Set(allRows.map(row=>`${row.ProductRef}:${row.VariantRef}`));
  const unrepresented=checked.filter(row=>Number(row.Available)>0&&!knownPairs.has(`${row.ProductRef}:${row.VariantRef}`));
  const products=payload.products.filter(row=>included.has(row.ProductRef));
  const variants=payload.variants.filter(row=>included.has(row.ProductRef)&&(!onlyInStock||includedPairs.has(`${row.ProductRef}:${row.VariantRef}`)));
  const prices=payload.prices.filter(row=>included.has(row.ProductRef));
  const pricedProducts=new Set(prices.filter(row=>row.Status==='candidate').map(row=>row.ProductRef));
  const stocksForExport=checked.filter(row=>included.has(row.ProductRef));
  return {...payload,products,variants,prices,catalogRows,stocks:stocksForExport,
    excludedProducts:payload.products.filter(row=>!included.has(row.ProductRef)),
    issues:[...payload.issues.filter(row=>included.has(row.productRef)),...unrepresented.map(row=>({productRef:row.ProductRef,variantRef:row.VariantRef,reasons:['stock-variant-not-in-catalog']}))],
    originalSummary,
    summary:{...payload.summary,products:products.length,variants:variants.length,prices:prices.length,
      candidatePrices:prices.filter(row=>row.Status==='candidate').length,
      productsWithAnyPrice:pricedProducts.size,productsWithoutAnyPrice:products.length-pricedProducts.size,
      catalogRows:catalogRows.length,rowsWithoutExactPrice:catalogRows.filter(row=>row.Price===null).length,
      productsWithStock:positive.size,excludedWithoutStock:payload.products.length-positive.size,
      inMamaivtsi:new Set(checked.filter(row=>row.WarehouseCode==='26-000004'&&Number(row.Available)>0).map(row=>row.ProductRef)).size,
      inMagala:new Set(checked.filter(row=>row.WarehouseCode==='26-000005'&&Number(row.Available)>0).map(row=>row.ProductRef)).size,
      unknownStockVariantRows:unrepresented.length},
    rules:{...payload.rules,onlyInStock,stock:'Current technical 1C register: Quantity is available, Reserved is separate and is not subtracted again. Aggregate organizations and batches by warehouse + product + variant; physical pickup reconciliation pending.',
      historicalStock:'not supported; prices may have an asOf override but stock is current'},
    stockCheckedAt:new Date().toISOString()};
}
