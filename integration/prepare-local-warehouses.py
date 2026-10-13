from django.db import transaction
from saleor.account.models import Address
from saleor.warehouse.models import Warehouse
from saleor.channel.models import Channel
assert Channel.objects.get(slug='vs-market-ua').currency_code=='UAH'
# Local inquiry catalog only. No fabricated street or postcode; complete before physical delivery setup.
with transaction.atomic():
    for key,city in [('mamaivtsi','Мамаївці'),('magala','Магала')]:
        slug='vsmarket-'+key
        warehouse=Warehouse.objects.filter(slug=slug).first()
        if warehouse:
            assert warehouse.external_reference=='vsmarket-warehouse:'+key
            continue
        address=Address.objects.create(country='UA',city=city,company_name='VS Market')
        Warehouse.objects.create(slug=slug,name='VS Market — '+city,address=address,
            external_reference='vsmarket-warehouse:'+key,
            private_metadata={'address_status':'street-and-postcode-pending','local_catalog_setup':'true'})
        print('Prepared local warehouse:',city)
