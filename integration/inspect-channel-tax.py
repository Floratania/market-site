from saleor.tax.models import TaxConfiguration
from saleor.channel.models import Channel
print([(f.name, str(f.default)) for f in TaxConfiguration._meta.fields])
channel=Channel.objects.get(slug='vs-market-ua')
print('Channel tax configuration count:',TaxConfiguration.objects.filter(channel=channel).count())
