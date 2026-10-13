import {spawn} from 'node:child_process';
// Manual sync only. Each dependent step finishes before the next one starts.
const steps=[
 ['export-catalog.mjs','--export'],['export-source-descriptions.mjs'],['import-catalog-saleor.mjs'],
 ['inspect-live-product-details.mjs'],['inspect-live-media.mjs'],['read-media-volumes.mjs'],
 ['extract-product-photos.mjs'],['prepare-product-enrichment.mjs'],['import-product-enrichment.mjs'],
 ['prepare-model-groups.mjs'],['prepare-model-product-type.mjs'],['apply-model-grouping.mjs'],
 ['verify-model-catalog.mjs'],
];
for(const [script,...args] of steps){
 console.log(`\nVS Market sync: ${script}`);
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[`integration/${script}`,...args],{stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code?reject(new Error(`Sync stopped at ${script} (${code})`)):resolve());});
}
console.log('VS Market catalog sync complete');
