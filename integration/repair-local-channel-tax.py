from django.db import transaction
from saleor.tax.models import TaxConfiguration
from saleor.channel.models import Channel
with transaction.atomic():
    channel=Channel.objects.get(slug='vs-market-ua',currency_code='UAH')
    config,created=TaxConfiguration.objects.get_or_create(channel=channel,defaults={
        'prices_entered_with_tax':True,'display_gross_prices':True
    })
    print('Local channel tax configuration created:',created)
