"""Render the small-size vector brand mark and share card. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PEACH = '#FBE9DC'
TERRA = '#9D5E53'
GREEN = '#314638'
# Cubic curves simplify the existing branching mark for small icon sizes.
CURVES = [
    ((51,53),(58,39),(70,20),(80,9)),
    ((51,53),(37,49),(24,42),(16,30)),
    ((51,53),(54,45),(53,35),(54,25)),
    ((51,53),(64,60),(77,59),(85,51)),
    ((51,53),(38,63),(24,73),(13,85)),
    ((51,53),(53,68),(61,83),(74,91)),
    ((51,53),(48,67),(43,74),(37,78)),
]

def mark(draw, origin, size, color, width):
    for curve in CURVES:
        points = []
        for i in range(101):
            t = i / 100
            weights = ((1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3)
            points.append(tuple(origin[j] + size * sum(w*p[j] for w,p in zip(weights,curve))/100 for j in (0,1)))
        draw.line(points, fill=color, width=width, joint='curve')
        radius = width / 2
        for x, y in points:
            draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)

paths = ''.join(f'<path d="M {a[0]} {a[1]} C {b[0]} {b[1]}, {c[0]} {c[1]}, {d[0]} {d[1]}"/>' for a,b,c,d in CURVES)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="{PEACH}"/><g fill="none" stroke="{TERRA}" stroke-width="4" stroke-linecap="round">{paths}</g></svg>\n'
(ROOT/'favicon.svg').write_text(svg)
icon = Image.new('RGB',(1024,1024),PEACH)
mark(ImageDraw.Draw(icon),(0,0),1024,TERRA,41)
for filename,size in [('apple-touch-icon.png',180),('icon-192.png',192),('icon-512.png',512)]:
    icon.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/'images'/filename)
icon.resize((256,256),Image.Resampling.LANCZOS).save(ROOT/'favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
# A typography-led share card, composed from the vector mark and native text.
share = Image.new('RGB',(1200,630),PEACH)
draw = ImageDraw.Draw(share)
serif = ImageFont.truetype('/usr/share/fonts/truetype/adf/AccanthisADFStd-Regular.otf',86)
body = ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-Regular.ttf',25)
draw.text((85,185),'COMMON',font=serif,fill=GREEN)
draw.text((85,285),'GROUND',font=serif,fill=GREEN)
draw.text((88,427),'Presence · Inquiry · Connection',font=body,fill=GREEN)
draw.text((88,545),'common-ground.space',font=body,fill=TERRA)
mark(draw,(775,120),330,TERRA,3)
share.save(ROOT/'images/common-ground-og.png')
