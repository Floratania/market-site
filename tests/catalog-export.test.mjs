import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExport,csv,zeroRef,applyStockFilter} from '../integration/catalog-export-format.mjs';

const productRef='0x11111111111111111111111111111111';
const otherRef='0x22222222222222222222222222222222';
const variantRef='0x33333333333333333333333333333333';
const type={Name:'Роздрібна ціна NEW',CurrencyCode:'980',CurrencyName:'UAH',IncludesVAT:true};
const price=(extra={})=>({ProductRef:productRef,VariantRef:zeroRef,Amount:'12000.50',IsActual:true,SamePeriodRows:1,IncludesVariants:true,...extra});
test('export preserves exact decimal prices and missing variant prices, and excludes ambiguous/inactive prices',()=>{
 const products=[{ProductRef:productRef,Name:'Вікно'},{ProductRef:otherRef,Name:'Двері'}];
 const variants=[{ProductRef:productRef,VariantRef:variantRef,Name:'Білий'}];
 const result=buildExport(products,variants,[price(),price({ProductRef:otherRef,IsActual:false})],type,'2026-10-08T13:00:00');
 assert.equal(result.catalogRows[0].Price,'12000.50');
 assert.equal(result.catalogRows[1].Price,null,'base price must not silently replace exact variant price');
 assert.equal(result.catalogRows[2].Price,null,'not-actual price is for review');
 assert.equal(result.summary.productsWithoutAnyPrice,1);
 assert.equal(result.summary.priceIssues,1);
 for(const override of [{SamePeriodRows:2},{Amount:'0'},{Amount:'-1'},{VariantRef:otherRef}]){
   const checked=buildExport([{ProductRef:productRef}],[],[price(override)],type,'2026-10-08T13:00:00');
   assert.equal(checked.prices[0].Status,'review');
 }
 assert.throws(()=>buildExport(products,variants,[price(),price()],type,'2026-10-08T13:00:00'),/duplicate/i);
});
test('Excel CSV retains Unicode, quotes, embedded newlines and neutralizes formula cells',()=>{
 const output=csv([{Name:'Двері; "Білі"\nNEW',Price:'12000.50'},{Name:' =HYPERLINK("x")',Price:null}],['Name','Price']);
 assert.ok(output.startsWith('\uFEFF'));
 assert.match(output,/"Двері; ""Білі""\nNEW"/);
 assert.match(output,/"' =HYPERLINK\(""x""\)"/);
 assert.match(output,/"12000\.50"/);
});
test('stock export excludes reserve-only items, preserves exact variants and does not subtract reserves twice',()=>{
 const payload=buildExport([{ProductRef:productRef,Name:'Вікно'},{ProductRef:otherRef,Name:'Двері'}],
   [{ProductRef:productRef,VariantRef:variantRef,Name:'Варіант'}],[price()],type,'2026-10-08T13:00:00');
 const stocks=[
   {ProductRef:productRef,VariantRef:variantRef,WarehouseCode:'26-000004',Available:'3.000',Reserved:'3.000'},
   {ProductRef:productRef,VariantRef:variantRef,WarehouseCode:'26-000005',Available:'-1.000',Reserved:'0.000'},
   {ProductRef:otherRef,VariantRef:zeroRef,WarehouseCode:'26-000004',Available:'0.000',Reserved:'5.000'}
 ];
 const filtered=applyStockFilter(payload,stocks,true);
 assert.equal(filtered.products.length,1);
 assert.equal(filtered.excludedProducts[0].ProductRef,otherRef);
 assert.equal(filtered.catalogRows.length,1,'base row with zero stock must be excluded even if a variant has stock');
 assert.equal(filtered.catalogRows[0].VariantRef,variantRef);
 assert.equal(filtered.catalogRows[0].AvailableMamaivtsi,'3.000','available already excludes reserve');
 assert.equal(filtered.catalogRows[0].Price,null,'do not borrow price from a different variant');
 assert.equal(filtered.summary.inMamaivtsi,1);
 assert.equal(filtered.summary.inMagala,0);
 assert.equal(filtered.summary.unknownStockVariantRows,0);
 assert.equal(applyStockFilter(payload,[],true).products.length,0);
 assert.throws(()=>applyStockFilter(payload,[stocks[0],stocks[0]],true),/Duplicate/);
 assert.throws(()=>applyStockFilter(payload,[{...stocks[0],WarehouseCode:'other'}],true),/scope/);
});
