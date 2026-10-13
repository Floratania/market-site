import sys,json,base64
from decimal import Decimal
from django.db import transaction
from saleor.product.models import Product,ProductType,ProductVariant,ProductMedia,VariantMedia,ProductChannelListing
from saleor.attribute.models import AttributeVariant,AssignedVariantAttribute,AssignedVariantAttributeValue

payload=json.load(sys.stdin)
type=ProductType.objects.get(slug='vsmarket-models-variants')
aliases=[];models=[]
active_skus={member['sku'] for group in payload['groups'] for member in group['members']}
if ProductVariant.objects.filter(product__product_type=type,channel_listings__channel__slug='vs-market-ua').exclude(sku__in=active_skus).exists():
 raise ValueError('Previously published SKU is absent or has no price in the new source. Review required; records and stock are preserved.')
with transaction.atomic():
 for group in payload['groups']:
  sources=[Product.objects.select_for_update().get(external_reference='vsmarket:'+m['productRef']) for m in group['members']]
  if any(p.private_metadata.get('integration')!='vsmarket-1c' for p in sources):raise ValueError('Source product ownership mismatch')
  if len({p.category_id for p in sources})!=1:raise ValueError('Model crosses categories; review grouping')
  common=[s for s in group['members'][0]['specs'] if all(any(v['key']==s['key'] and v['value']==s['value'] and v.get('unit')==s.get('unit') for v in m['specs']) for m in group['members'])]
  model,created=Product.objects.get_or_create(external_reference='vsmarket-model:'+group['id'],defaults={
   'name':group['name'],'slug':'model-'+group['id'],'product_type':type,'category_id':sources[0].category_id,
   'tax_class_id':sources[0].tax_class_id,'metadata':{'public_specs':json.dumps(common,ensure_ascii=False)},
   'private_metadata':{'integration':'vsmarket-1c-model','model_key':group['key']},'search_index_dirty':True})
  if model.private_metadata.get('integration')!='vsmarket-1c-model':raise ValueError('Model ownership mismatch')
  model.name=model.private_metadata.get('storefront_name_override') or group['name'];model.metadata={**model.metadata,'public_specs':json.dumps(common,ensure_ascii=False)}
  model.save(update_fields=['name','metadata'])
  model_media_order=0;variant_ids=[]
  for index,(member,source) in enumerate(zip(group['members'],sources)):
   variant=ProductVariant.objects.select_for_update().get(sku=member['sku'])
   if variant.external_reference!='vsmarket:'+member['productRef']+':0x00000000000000000000000000000000':raise ValueError('Variant reference mismatch')
   previous_parent=variant.product
   if variant.product_id not in (source.id,model.id) and not (previous_parent.private_metadata.get('integration')=='vsmarket-1c-model' and variant.private_metadata.get('1c_source_product_id')==str(source.id)):raise ValueError('Variant already belongs to an unrelated model')
   source.default_variant=None;source.save(update_fields=['default_variant'])
   variant.product=model;variant.name=variant.private_metadata.get('storefront_variant_name_override') or member['sourceName'];variant.sort_order=index
   variant.metadata={**source.metadata,**{k:v for k,v in variant.metadata.items() if k.startswith('storefront_')},'source_name':member['sourceName'],'public_specs':json.dumps(member['specs'],ensure_ascii=False)}
   variant.private_metadata={**variant.private_metadata,'1c_source_product_id':str(source.id),'1c_source_slug':source.slug,'1c_model_id':group['id']}
   variant.save(update_fields=['product','name','sort_order','metadata','private_metadata'])
   variant.attributes.filter(assignment__attribute__external_reference__startswith='vsmarket-spec:').delete()
   for value in source.attributevalues.select_related('value'):
    assignment=AttributeVariant.objects.get(product_type=type,attribute_id=value.value.attribute_id)
    assigned,_=AssignedVariantAttribute.objects.get_or_create(variant=variant,assignment=assignment)
    AssignedVariantAttributeValue.objects.get_or_create(variant=variant,assignment=assigned,value=value.value,defaults={'sort_order':value.sort_order})
   # Media IDs and file bytes stay the same. Link photos to their exact SKU.
   media=list(ProductMedia.objects.filter(product=source).order_by('sort_order','id'))
   old_media=list(variant.media.order_by('sort_order','id'))
   media=old_media+[m for m in media if m.id not in {old.id for old in old_media}]
   for image in media:
    image.product=model;image.sort_order=model_media_order;model_media_order+=1;image.save(update_fields=['product','sort_order'])
    VariantMedia.objects.get_or_create(variant=variant,media=image)
   source.channel_listings.update(is_published=False,visible_in_listings=False,available_for_purchase_at=None)
   source.private_metadata={**source.private_metadata,'1c_model_id':group['id'],'1c_model_product_id':str(model.id)}
   source.save(update_fields=['private_metadata'])
   variant_id=base64.b64encode(('ProductVariant:'+str(variant.id)).encode()).decode();variant_ids.append(variant.id)
   aliases.append({'sourceSlug':source.slug,'modelSlug':model.slug,'variantId':variant_id,'sku':variant.sku})
  for listing in sources[0].channel_listings.all():
   disabled=model.private_metadata.get('storefront_disabled:'+listing.channel.slug)=='true'
   prices=list(ProductVariant.objects.filter(id__in=variant_ids).values_list('channel_listings__price_amount',flat=True))
   prices=[price for price in prices if price is not None]
   if not prices:raise ValueError('Published model has no prices')
   ProductChannelListing.objects.update_or_create(product=model,channel_id=listing.channel_id,defaults={
    'currency':listing.currency,'is_published':not disabled,'visible_in_listings':True,'published_at':listing.published_at,
    'available_for_purchase_at':payload['availableAt'],'discounted_price_amount':min(prices),'discounted_price_dirty':True})
  model.default_variant_id=variant_ids[0];model.search_index_dirty=True;model.save(update_fields=['default_variant','search_index_dirty'])
  models.append({'id':model.id,'slug':model.slug,'name':model.name,'variantCount':len(variant_ids)})
 # Retired model containers stay recoverable but cannot appear as empty cards.
 ProductChannelListing.objects.filter(product__private_metadata__integration='vsmarket-1c-model',product__variants__isnull=True).update(is_published=False,visible_in_listings=False,available_for_purchase_at=None)
print('GROUP_RESULT:'+json.dumps({'models':models,'aliases':aliases},ensure_ascii=False))
