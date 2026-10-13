import os,sys,json,uuid,hashlib
from collections import defaultdict
from decimal import Decimal
os.environ.setdefault('DJANGO_SETTINGS_MODULE','saleor.settings')
import django
django.setup()
from django.db import connection,transaction
from django.db.models import Sum
from django.utils import timezone
from saleor.warehouse.models import Stock,Allocation
from saleor.product.models import ProductVariantChannelListing
from saleor.discount.models import Voucher,VoucherCode,VoucherCustomer
from saleor.discount.utils.voucher import get_voucher_code_instance,increase_voucher_usage,increase_voucher_code_usage_value,decrease_voucher_code_usage_value,remove_voucher_usage_by_customer,activate_voucher_code

class Problem(Exception):
 def __init__(self,message,status=409):self.message=message;self.status=status

def initialize():
 with connection.cursor() as c:
  c.execute('CREATE TABLE IF NOT EXISTS storefront_order_commit (order_id uuid PRIMARY KEY, payload jsonb NOT NULL, released boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now())')

def records():
 with connection.cursor() as c:
  c.execute('SELECT payload FROM storefront_order_commit WHERE released=false')
  return [json.loads(r[0]) if isinstance(r[0],str) else r[0] for r in c.fetchall()]

def snapshot():
 holds=defaultdict(int)
 for record in records():
  for a in record.get('allocations',[]):holds[(a['sku'],a['location'])]+=a['quantity']
 return {'items':[{'sku':s,'location':w,'quantity':q} for (s,w),q in holds.items()]}

def rules(code):
 voucher=code.voucher
 obj={'voucher':{f.name:str(getattr(voucher,f.name)) for f in voucher._meta.fields if f.name not in ('metadata','private_metadata')},'listings':list(voucher.channel_listings.values()),'products':list(voucher.products.order_by('pk').values_list('pk',flat=True)),'variants':list(voucher.variants.order_by('pk').values_list('pk',flat=True)),'categories':list(voucher.categories.order_by('pk').values_list('pk',flat=True)),'collections':list(voucher.collections.order_by('pk').values_list('pk',flat=True))}
 return hashlib.sha256(json.dumps(obj,sort_keys=True,default=str).encode()).hexdigest()

def prepare(code):
 if not code:return {'fingerprint':None}
 row=VoucherCode.objects.select_related('voucher').filter(code=code).first()
 if not row:raise Problem('Промокод не знайдено.',400)
 return {'fingerprint':rules(row)}

def operate(data):
 initialize()
 if data['operation']=='snapshot':
  result=snapshot()
  native=Allocation.objects.filter(quantity_allocated__gt=0,stock__warehouse__slug__in=['vsmarket-mamaivtsi','vsmarket-magala']).values('stock__product_variant__sku','stock__warehouse__slug').annotate(quantity=Sum('quantity_allocated'))
  result['nativeItems']=[{'sku':r['stock__product_variant__sku'],'location':r['stock__warehouse__slug'].removeprefix('vsmarket-'),'quantity':r['quantity']} for r in native]
  return result
 if data['operation']=='prepare':return prepare(data.get('code'))
 if data['operation']=='lookup':
  with connection.cursor() as c:
   c.execute('SELECT payload,released FROM storefront_order_commit WHERE order_id=%s',[str(uuid.UUID(data['id']))]);row=c.fetchone()
  if not row:return None
  value=json.loads(row[0]) if isinstance(row[0],str) else row[0]
  return {**value,'released':row[1]}
 order=data['order'];order_id=str(uuid.UUID(order['id']));code_text=order.get('pricing',{}).get('promotion',{}).get('code') if order.get('pricing',{}).get('promotion') else None
 with transaction.atomic():
  with connection.cursor() as c:
   c.execute('SELECT pg_advisory_xact_lock(812970431)')
   c.execute('SELECT payload,released FROM storefront_order_commit WHERE order_id=%s FOR UPDATE',[order_id]);previous=c.fetchone()
  old=json.loads(previous[0]) if previous and isinstance(previous[0],str) else previous[0] if previous else None
  if data['operation']=='settle':
   if not previous or previous[1]:raise Problem('Активний резерв не знайдено.')
   reference=str(data.get('reference','')).strip()
   if not 3<=len(reference)<=120:raise Problem('Вкажіть номер документа обліку.',400)
   if old.get('settled'):
    if old.get('accountingReference')!=reference:raise Problem('Резерв уже узгоджено з іншим документом.')
    return old
   value={**old,'allocations':[],'settled':True,'accountingReference':reference,'settledAt':timezone.now().isoformat()}
   with connection.cursor() as c:c.execute('UPDATE storefront_order_commit SET payload=%s,updated_at=now() WHERE order_id=%s',[json.dumps(value,default=str),order_id])
   return value
  if data['operation']=='release':
   if not previous or previous[1]:return {'released':True,'allocations':[]}
   if old.get('code'):
    voucher=Voucher.objects.select_for_update().filter(pk=old['voucherId']).first()
    code=VoucherCode.objects.select_for_update().filter(pk=old['codeId']).first()
    if code:
     decrease_voucher_code_usage_value(code)
     if old.get('singleUse'):activate_voucher_code(code)
     if old.get('oncePerCustomer') and old.get('email'):remove_voucher_usage_by_customer(code,old['email'])
   with connection.cursor() as c:c.execute('UPDATE storefront_order_commit SET released=true,updated_at=now() WHERE order_id=%s',[order_id])
   return {'released':True,'allocations':[]}
  if previous and not previous[1]:return {**old,'replayed':True}
  code=None
  if code_text:
   initial=VoucherCode.objects.filter(code=code_text).first()
   if not initial:raise Problem('Промокод більше не доступний.')
   Voucher.objects.select_for_update().get(pk=initial.voucher_id)
   list(VoucherCode.objects.select_for_update().filter(voucher_id=initial.voucher_id).order_by('pk'))
   try:code=get_voucher_code_instance(code_text,'vs-market-ua')
   except Exception:raise Problem('Промокод вичерпано або він більше не діє.')
   if rules(code)!=data.get('voucherFingerprint'):raise Problem('Умови промокоду змінилися. Оновіть замовлення.')
  lines=[l for l in order['lines'] if l.get('sku')]
  quantities={l['sku']:l['quantity'] for l in lines}
  if len(quantities)!=len(lines) or any(not isinstance(q,int) or q<1 for q in quantities.values()):raise Problem('Перевірте товари замовлення.',400)
  listings=list(ProductVariantChannelListing.objects.select_for_update().filter(variant__sku__in=quantities,channel__slug='vs-market-ua').select_related('variant').order_by('pk'))
  prices={l.variant.sku:l.price_amount for l in listings}
  for line in lines:
   if line['sku'] not in prices or Decimal(str(line['unitPrice']))!=prices[line['sku']]:raise Problem('Ціна змінилася. Потрібно узгодити замовлення з покупцем.')
  stocks=list(Stock.objects.select_for_update().filter(product_variant__sku__in=quantities,warehouse__slug__in=['vsmarket-mamaivtsi','vsmarket-magala']).select_related('warehouse','product_variant').order_by('pk'))
  native={r['stock_id']:r['q'] for r in Allocation.objects.filter(stock_id__in=[s.pk for s in stocks]).values('stock_id').annotate(q=Sum('quantity_allocated'))}
  held={(r['sku'],r['location']):r['quantity'] for r in snapshot()['items']}
  allocations=[]
  for sku,quantity in sorted(quantities.items()):
   candidates=[s for s in stocks if s.product_variant.sku==sku]
   if order.get('delivery')=='pickup':candidates=[s for s in candidates if s.warehouse.slug=='vsmarket-'+order.get('location','')]
   for s in candidates:
    location=s.warehouse.slug.removeprefix('vsmarket-');available=max(0,s.quantity-native.get(s.pk,0)-held.get((sku,location),0));take=min(quantity,available)
    if take:allocations.append({'sku':sku,'location':location,'quantity':take});quantity-=take
    if not quantity:break
   if quantity:raise Problem('Недостатньо вільного залишку для '+sku+'. Замовлення не підтверджено.')
  email=(order.get('customer',{}).get('email') or '').strip().lower() or None
  result={'allocations':allocations,'committedAt':timezone.now().isoformat(),'released':False,'code':code_text,'discount':order.get('pricing',{}).get('discount',0),'total':order.get('pricing',{}).get('total'),'email':email,'pricing':order.get('pricing')}
  if code:
   if code.voucher.apply_once_per_customer and (not email or VoucherCustomer.objects.filter(voucher_code=code,customer_email__iexact=email).exists()):raise Problem('Промокод потребує email або вже використаний цим покупцем.')
   try:increase_voucher_usage(code.voucher,code,result['email'])
   except Exception:raise Problem('Промокод уже використано цим покупцем.')
   if not code.voucher.usage_limit:increase_voucher_code_usage_value(code)
   result.update({'voucherId':code.voucher_id,'codeId':code.pk,'singleUse':code.voucher.single_use,'oncePerCustomer':code.voucher.apply_once_per_customer})
  with connection.cursor() as c:c.execute('INSERT INTO storefront_order_commit(order_id,payload,released) VALUES(%s,%s,false) ON CONFLICT(order_id) DO UPDATE SET payload=EXCLUDED.payload,released=false,updated_at=now()',[order_id,json.dumps(result,default=str)])
  return result

if __name__=='__main__':
 try:result={'ok':True,'data':operate(json.load(sys.stdin))}
 except Problem as e:result={'ok':False,'status':e.status,'error':e.message}
 except Exception:result={'ok':False,'status':503,'error':'Не вдалося завершити резервування. Повторіть дію.'}
 print('VSMARKET_RESULT:'+json.dumps(result,ensure_ascii=False,default=str))
