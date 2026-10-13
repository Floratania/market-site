import fs from 'node:fs/promises';
import sql from 'mssql';
import {buildExport, canonicalRef, csv, applyStockFilter} from './catalog-export-format.mjs';

const base=new URL('./',import.meta.url);
const mode=process.argv[2] || '--export';
if(!['--export','--discover','--operational'].includes(mode))throw new Error('Use --discover, --export or --operational');
const config=JSON.parse((await fs.readFile(new URL('bi-connection.local.json',base),'utf8')).replace(/^\uFEFF/,''));
if(['server','database','user','password'].some(key=>typeof config[key]!=='string'||!config[key].trim())){
  console.error('Missing local SQL connection fields. No connection attempted.');process.exit(2);
}
if(config.port && (!Number.isInteger(config.port)||config.port<1||config.port>65535))throw new Error('Invalid SQL port');
const options=JSON.parse(await fs.readFile(new URL('catalog-export.config.json',base),'utf8'));
if(!Number.isSafeInteger(options.dataSeparator)||options.dataSeparator<0||typeof options.groupCode!=='string')throw new Error('Invalid export scope');
const [server,instanceName]=config.server.split('\\');
const pool=new sql.ConnectionPool({server,database:config.database,user:config.user,password:config.password,
  ...(config.port?{port:config.port}:{}),options:{encrypt:config.encrypt!==false,trustServerCertificate:config.trustServerCertificate===true,
    readOnlyIntent:true,...(instanceName&&!config.port?{instanceName}:{})},connectionTimeout:10000,requestTimeout:120000,pool:{min:0,max:1}});
try{
  await pool.connect();
  const schema=await pool.request().query(`SELECT o.name AS ObjectName,c.name AS ColumnName
    FROM [vsmarket].sys.objects o JOIN [vsmarket].sys.columns c ON c.object_id=o.object_id
    WHERE o.type='U' AND o.name IN(N'_Reference159',N'_Reference273',N'_Reference71',N'_Reference53',N'_InfoRg10550',N'_Reference251',N'_InfoRg9273');`);
  const required={
    _Reference159:['_IDRRef','_ParentIDRRef','_Folder','_Fld771','_Marked','_Code','_Description','_Fld14069','_Fld14036','_Fld14105','_Fld14047','_Fld14038RRef'],
    _Reference273:['_IDRRef','_OwnerID_TYPE','_OwnerID_RTRef','_OwnerID_RRRef','_Fld771','_Marked','_Code','_Description','_Fld16486','_Fld16484','_Fld17290','_Fld17291','_Fld17292','_Fld17293','_Fld17294'],
    _Reference71:['_IDRRef','_Fld771','_Marked','_Code','_Description','_Fld12366RRef','_Fld12367','_Fld12377'],
    _Reference53:['_IDRRef','_Fld771','_Code','_Description','_Fld12132'],
    _InfoRg10550:['_Period','_Fld771','_Fld10551RRef','_Fld10552RRef','_Fld10553RRef','_Fld10554','_Fld10555','_Fld10556_TYPE','_Fld10556_RTRef','_Fld10556_RRRef','_Fld10557'],
    _Reference251:['_IDRRef','_Fld771','_Marked','_Code','_Description'],
    _InfoRg9273:['_Fld771','_Fld9275_TYPE','_Fld9275_RTRef','_Fld9275_RRRef','_Fld9276RRef','_Fld9277RRef','_Fld9279','_Fld9280']
  };
  for(const [table,columns] of Object.entries(required))for(const column of columns){
    if(!schema.recordset.some(row=>row.ObjectName===table&&row.ColumnName===column))throw new Error(`Source schema mismatch: ${table}.${column}`);
  }
  const types=await pool.request().input('separator',sql.Int,options.dataSeparator).query(`
    SELECT CONVERT(varchar(34),p._IDRRef,1) AS Ref,RTRIM(p._Code) AS Code,p._Description AS Name,
      CONVERT(varchar(34),p._Fld12366RRef,1) AS CurrencyRef,RTRIM(c._Code) AS CurrencyCode,
      c._Description AS CurrencyName,c._Fld12132 AS CurrencySymbol,
      CONVERT(bit,p._Fld12367) AS IncludesVAT,CONVERT(bit,p._Fld12377) AS PricesActual
    FROM [vsmarket].dbo._Reference71 p
    LEFT JOIN [vsmarket].dbo._Reference53 c ON c._IDRRef=p._Fld12366RRef AND c._Fld771=p._Fld771
    WHERE p._Fld771=@separator AND p._Marked=0x00 ORDER BY p._Description;`);
  await fs.writeFile(new URL('price-types.local.json',base),JSON.stringify(types.recordset,null,2));
  if(mode==='--discover'){
    console.log(JSON.stringify(types.recordset.map(({Ref,Name,CurrencyCode,CurrencyName,IncludesVAT,PricesActual})=>({Ref,Name,CurrencyCode,CurrencyName,IncludesVAT,PricesActual})),null,2));
  }else{
    const selected=types.recordset.filter(row=>options.priceTypeRef?canonicalRef(row.Ref)===canonicalRef(options.priceTypeRef):row.Name.trim().toLocaleLowerCase('uk')===(options.priceTypeName||'').trim().toLocaleLowerCase('uk'));
    if(selected.length!==1)throw new Error('Choose one exact price type in catalog-export.config.json; run --discover first');
    const root=await pool.request().input('separator',sql.Int,options.dataSeparator).input('groupCode',sql.NVarChar(32),options.groupCode).query(`
      SELECT CONVERT(varchar(34),_IDRRef,1) AS Ref FROM [vsmarket].dbo._Reference159
      WHERE _Code=@groupCode AND _Fld771=@separator AND _Marked=0x00 AND _Folder=0x00;
      SELECT CONVERT(varchar(33),GETDATE(),126) AS AsOf;
      SELECT RTRIM(_Code) AS Code FROM [vsmarket].dbo._Reference251
      WHERE _Fld771=@separator AND _Marked=0x00 AND _Code IN(N'26-000004',N'26-000005');`);
    if(root.recordsets[0].length!==1)throw new Error('Catalog group is missing or ambiguous');
    if(root.recordsets[2].length!==2||new Set(root.recordsets[2].map(row=>row.Code)).size!==2)throw new Error('Warehouse codes are missing or ambiguous');
    const asOf=options.asOf || root.recordsets[1][0].AsOf;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(asOf))throw new Error('asOf must be a SQL local datetime without timezone');
    const query=await fs.readFile(new URL('catalog-export.sql',base),'utf8');
    const result=await pool.request().input('separator',sql.Int,options.dataSeparator)
      .input('groupCode',sql.NVarChar(32),options.groupCode)
      .input('priceType',sql.Binary(16),Buffer.from(selected[0].Ref.slice(2),'hex'))
      .input('asOf',sql.VarChar(33),asOf).query(query);
    if(result.recordsets.length!==4||!result.recordsets[0].length)throw new Error('Empty or incomplete catalog export');
    const payload=applyStockFilter(buildExport(...result.recordsets.slice(0,3),selected[0],asOf),result.recordsets[3],mode==='--operational'?false:options.onlyInStock===true);
    if(mode==='--operational'){
      const target=new URL('operational-export.local.json',base),temporary=new URL('operational-export.local.json.tmp',base);
      await fs.writeFile(temporary,JSON.stringify(payload));await fs.rename(temporary,target);
      console.log(JSON.stringify({products:payload.products.length,stockCheckedAt:payload.stockCheckedAt}));
      await pool.close();process.exit(0);
    }
    const folder=new URL(`exports/catalog-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}/`,base);
    await fs.mkdir(folder,{recursive:true});
    await fs.writeFile(new URL('catalog.local.json',folder),JSON.stringify(payload,null,2));
    for(const [name,rows,columns] of [
      ['products',payload.products,['ProductRef','ParentRef','Code','Name','Article','WidthRaw','HeightRaw','UnitRef']],
      ['variants',payload.variants,['ProductRef','VariantRef','Code','Name','Article','WidthRaw','HeightRaw','Color','Profile','VariantType']],
      ['prices',payload.prices,['ProductRef','VariantRef','PriceType','Amount','CurrencyCode','CurrencyName','IncludesVAT','IsActual','PeriodLocal','IncludesVariants','UnitValueType','UnitReferenceType','UnitRef','SamePeriodRows','Status']],
      ['catalog-with-prices',payload.catalogRows,['ProductRef','VariantRef','Code','Name','Article','VariantCode','VariantName','VariantArticle','WidthRaw','HeightRaw','VariantWidthRaw','VariantHeightRaw','Color','Profile','VariantType','PriceType','Price','Currency','IncludesVAT','PriceStatus','PricePeriodLocal','PriceIncludesVariants','UnitRef','PriceUnitRef','PriceUnitReferenceType','AvailableMamaivtsi','ReservedMamaivtsi','AvailableMagala','ReservedMagala']],
      ['stock',payload.stocks,['ProductRef','VariantRef','WarehouseCode','WarehouseName','Available','Reserved']],
      ['products-without-stock',payload.excludedProducts,['ProductRef','Code','Name','Article']],
      ['products-without-price',payload.products.filter(product=>!payload.prices.some(price=>price.ProductRef===product.ProductRef&&price.Status==='candidate')),['ProductRef','Code','Name','Article']]
    ])await fs.writeFile(new URL(`${name}.csv`,folder),csv(rows,columns));
    await fs.writeFile(new URL('summary.json',folder),JSON.stringify({exportedAt:payload.exportedAt,asOf,stockCheckedAt:payload.stockCheckedAt,priceType:payload.priceType,summary:payload.summary,originalSummary:payload.originalSummary,issues:payload.issues,rules:payload.rules},null,2));
    console.log(JSON.stringify({folder:decodeURIComponent(folder.pathname),priceType:payload.priceType.Name,...payload.summary},null,2));
  }
}catch(error){
  console.error(error.code||error.number?`SQL export failed (${error.code||'SQL'}, ${error.number||0}). Secrets are not logged.`:error.message);
  process.exitCode=1;
}finally{await pool.close();}
