import test from 'node:test';
import assert from 'node:assert/strict';
import {setProductActivation,manuallyDisabled,disabledKey} from '../integration/product-activation.mjs';
test('model deactivation and reactivation target only this channel and retain the import choice',async()=>{
 const state={active:true,metadata:[{key:'other',value:'untouched'}]},calls=[];
 const graphql=async(query,variables)=>{
  calls.push({query,variables});
  if(query.includes('ManageActivationProduct'))return {product:{id:'model-1',privateMetadata:state.metadata,channelListings:[{channel:{id:'channel-1',slug:'vs-market-ua'},isPublished:state.active},{channel:{id:'other-channel',slug:'other'},isPublished:true}]}};
  if(query.includes('ManageActivationFlag')){const input=variables.input[0];state.metadata=state.metadata.filter(item=>item.key!==input.key).concat(input);return {updatePrivateMetadata:{errors:[]}};}
  assert.deepEqual(variables.input,{updateChannels:[{channelId:'channel-1',isPublished:!state.active}]});
  state.active=variables.input.updateChannels[0].isPublished;
  return {productChannelListingUpdate:{errors:[],product:{id:'model-1',channelListings:[{channel:{slug:'vs-market-ua'},isPublished:state.active}]}}};
 };
 assert.deepEqual(await setProductActivation(graphql,'vs-market-ua',{productId:'model-1',active:false,channelId:'other-channel'}),{productId:'model-1',active:false});
 assert.equal(manuallyDisabled(state.metadata,'vs-market-ua'),true);assert.equal(state.metadata[0].value,'untouched');
 await setProductActivation(graphql,'vs-market-ua',{productId:'model-1',active:true});assert.equal(manuallyDisabled(state.metadata,'vs-market-ua'),false);
 await assert.rejects(setProductActivation(graphql,'vs-market-ua',{productId:'model-1',active:'false'}),{status:400});
 await assert.rejects(setProductActivation(graphql,'missing-channel',{productId:'model-1',active:false}),{status:404});
});
test('failed publication restores the previous manual flag',async()=>{
 const flags=[];
 const graphql=async(query,variables)=>{
  if(query.includes('ManageActivationProduct'))return {product:{id:'model-1',privateMetadata:[{key:disabledKey('site'),value:'false'}],channelListings:[{channel:{id:'c1',slug:'site'},isPublished:true}]}};
  if(query.includes('ManageActivationFlag')){flags.push(variables.input[0].value);return {updatePrivateMetadata:{errors:[]}};}
  return {productChannelListingUpdate:{errors:[{code:'INVALID'}]}};
 };
 await assert.rejects(setProductActivation(graphql,'site',{productId:'model-1',active:false}),{status:409});assert.deepEqual(flags,['true','false']);
});
