import {novaCities,novaWarehouses,validateNovaDelivery} from './nova-poshta.mjs';
import {orderSettings} from './order-settings.mjs';
try {
  const config=(await orderSettings()).novaPoshta || {};
  const cities=await novaCities('Чернівці',config);
  console.log({cityCount:cities.length,city:cities[0]?.name});
  if(cities[0]){const warehouses=await novaWarehouses(cities[0].ref,'',config);console.log({warehouseCount:warehouses.length,firstWarehouse:warehouses[0]?.name});const selected=warehouses[1];if(selected){const verified=await validateNovaDelivery({kind:'branch',city:cities[0].name,cityRef:cities[0].ref,warehouse:selected.name,warehouseRef:selected.ref},config);console.log({selectedWarehouse:selected.name,verified:verified.verified});}}
}catch(error){console.log({available:false,message:error.message});process.exitCode=1;}
