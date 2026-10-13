import json
from saleor.product.models import Product,ProductVariant
models=Product.objects.filter(private_metadata__integration='vsmarket-1c-model',channel_listings__is_published=True).distinct()
count=0;dimensions=0
for product in models:
 for variant in product.variants.all():
  specs=json.loads(variant.metadata.get('public_specs','[]'))
  attrs={assignment.assignment.attribute.external_reference:[str(value.numeric) if assignment.assignment.attribute.input_type=='numeric' else value.name for value in assignment.values.all()] for assignment in variant.attributes.select_related('assignment__attribute')}
  for spec in specs:
   values=attrs.get('vsmarket-spec:'+spec['key'],[])
   if spec['key'] in ['width','height']:
    from decimal import Decimal
    assert len(values)==1 and Decimal(values[0])==Decimal(spec['value']),(variant.sku,spec['key'],values)
    assignment=variant.attributes.get(assignment__attribute__external_reference='vsmarket-spec:'+spec['key'])
    assert assignment.assignment.attribute.unit=='mm'
    dimensions+=1
   else:assert values==[spec['value']],(variant.sku,spec['key'],values)
  assert variant.private_metadata.get('1c_source_product_id')
  assert all(image.product_id==variant.product_id for image in variant.media.all())
  count+=1
print(json.dumps({'models':models.count(),'variants':count,'verifiedNumericDimensionValues':dimensions,'nativeAttributesMatch':True}))
