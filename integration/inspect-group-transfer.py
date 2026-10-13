import json
from saleor.product import models as p
for name in ['ProductChannelListing','ProductVariantChannelListing']:
 model=getattr(p,name)
 print(name,json.dumps([{'name':f.name,'type':f.__class__.__name__} for f in model._meta.fields]))
