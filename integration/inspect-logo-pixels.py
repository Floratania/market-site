from PIL import Image
from pathlib import Path
path = Path(__file__).resolve().parent.parent / 'public' / 'logo.png'
img = Image.open(path).convert('RGBA')
print('Logo size:', img.size)
for y in range(max(0,img.height-10),img.height):
    xs=[x for x in range(img.width) if (lambda p: p[3]>0 and max(p[:3])<180)(img.getpixel((x,y)))]
    if xs: print('Dark pixels at row',y,':',min(xs),max(xs),'count',len(xs))
