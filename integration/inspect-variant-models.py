import json
from saleor.product import models as p
from saleor.attribute import models as a
for name in ['Product','ProductVariant','ProductMedia','VariantMedia']:
 model=getattr(p,name,None)
 if model:print(name,json.dumps([{'name':f.name,'type':f.__class__.__name__,'related':str(getattr(f,'related_model',None))} for f in model._meta.get_fields()]))
for name in ['AssignedProductAttribute','AssignedVariantAttribute','AttributeProduct','AttributeVariant','AssignedVariantAttributeValue','AssignedProductAttributeValue']:
 model=getattr(a,name,None)
 if model:print(name,json.dumps([{'name':f.name,'type':f.__class__.__name__,'related':str(getattr(f,'related_model',None))} for f in model._meta.get_fields()]))
