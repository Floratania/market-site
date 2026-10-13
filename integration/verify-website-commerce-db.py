import os,sys,json,uuid,datetime
os.environ.setdefault('DJANGO_SETTINGS_MODULE','saleor.settings')
import django
django.setup()
from django.db import connection,close_old_connections
from django.utils import timezone
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from saleor.product.models import Product,ProductType,ProductVariant,ProductVariantChannelListing
from saleor.channel.models import Channel
from saleor.warehouse.models import Stock,Warehouse
from saleor.discount.models import Voucher,VoucherCode,VoucherChannelListing

source=json.load(sys.stdin)['script'];namespace={'__name__':'commerce_module'};exec(source,namespace)
operate=namespace['operate'];Problem=namespace['Problem']
tag=uuid.uuid4().hex;sku='TEST-RESERVE-'+tag;code_text='TEST-PROMO-'+tag;ids=[str(uuid.uuid4()) for _ in range(4)];product=voucher=None
try:
 channel=Channel.objects.get(slug='vs-market-ua');warehouse=Warehouse.objects.get(slug='vsmarket-mamaivtsi')
 product=Product.objects.create(product_type=ProductType.objects.get(slug='vsmarket-accessories'),name='Disposable reservation test',slug='test-reserve-'+tag)
 variant=ProductVariant.objects.create(product=product,sku=sku,name='Disposable',track_inventory=True)
 ProductVariantChannelListing.objects.create(variant=variant,channel=channel,currency='UAH',price_amount=Decimal('10'))
 Stock.objects.create(product_variant=variant,warehouse=warehouse,quantity=1)
 voucher=Voucher.objects.create(name='Disposable voucher test',type='entire_order',discount_value_type='percentage',usage_limit=1,single_use=True,apply_once_per_customer=True,start_date=timezone.now()-datetime.timedelta(minutes=1))
 VoucherChannelListing.objects.create(voucher=voucher,channel=channel,currency='UAH',discount_value=Decimal('10'))
 code=VoucherCode.objects.create(voucher=voucher,code=code_text,is_active=True)
 fingerprint=operate({'operation':'prepare','code':code_text})['fingerprint']
 orders=[{'id':i,'customer':{'email':'reservation-test@example.invalid'},'delivery':'pickup','location':'mamaivtsi','lines':[{'sku':sku,'quantity':1,'unitPrice':10}],'pricing':{'discount':1,'total':9,'promotion':{'code':code_text}}} for i in ids[:2]]
 def confirm(order):
  close_old_connections()
  try:return {'ok':True,'id':order['id'],'data':operate({'operation':'commit','order':order,'voucherFingerprint':fingerprint})}
  except Problem as e:return {'ok':False,'error':e.message}
  finally:close_old_connections()
 with ThreadPoolExecutor(max_workers=2) as executor:results=list(executor.map(confirm,orders))
 assert sum(r['ok'] for r in results)==1,results
 winner=next(r for r in results if r['ok']);order=next(o for o in orders if o['id']==winner['id']);replay=operate({'operation':'commit','order':order,'voucherFingerprint':fingerprint});assert replay['replayed']
 code.refresh_from_db();assert code.used==1 and not code.is_active
 snap=operate({'operation':'snapshot'});assert next(r for r in snap['items'] if r['sku']==sku)['quantity']==1
 operate({'operation':'release','order':order});operate({'operation':'release','order':order});code.refresh_from_db();assert code.used==0 and code.is_active
 loser=next(o for o in orders if o['id']!=winner['id']);operate({'operation':'commit','order':loser,'voucherFingerprint':fingerprint});code.refresh_from_db();assert code.used==1
 settled=operate({'operation':'settle','order':loser,'reference':'TEST-INVENTORY-DOC'});assert settled['settled'] and not settled['allocations'];code.refresh_from_db();assert code.used==1
 assert not any(r['sku']==sku for r in operate({'operation':'snapshot'})['items'])
 ordinary=[{'id':i,'customer':{},'delivery':'pickup','location':'mamaivtsi','lines':[{'sku':sku,'quantity':1,'unitPrice':10}],'pricing':{'discount':0,'total':10}} for i in ids[2:]]
 with ThreadPoolExecutor(max_workers=2) as executor:stock_results=list(executor.map(confirm,ordinary))
 assert sum(r['ok'] for r in stock_results)==1,stock_results
 print('VSMARKET_TEST:'+json.dumps({'concurrentConfirmations':2,'successful':1,'lastUnitProtectedWithoutCoupon':True,'duplicateUsePrevented':True,'retryIdempotent':True,'cancelRestoresStockAndCode':True,'settlementPreservesCouponUse':True}))
finally:
 for order_id in ids:
  try:operate({'operation':'release','order':{'id':order_id}})
  except Exception:pass
 with connection.cursor() as cursor:cursor.execute('DELETE FROM storefront_order_commit WHERE order_id IN (%s,%s,%s,%s)',ids)
 if voucher:voucher.delete()
 if product:product.delete()
