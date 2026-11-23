"""Print a repeating, perforated strip of 35 mm stock for each team member."""
from pathlib import Path
from io import BytesIO
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/film/stock'
OUT.mkdir(exist_ok=True)
face = TTFont(ROOT/'public/fonts/2.woff2')
face.flavor = None
buf = BytesIO()
face.save(buf)
font = ImageFont.truetype(BytesIO(buf.getvalue()), 24)
tiny = ImageFont.truetype(BytesIO(buf.getvalue()), 17)
plates = sorted((ROOT/'art/library/hardware').glob('plate-*.jpg'))
members = json.loads((ROOT/'records.json').read_text())['members']
for i, member in enumerate(members):
    rng = np.random.default_rng(931+i)
    noise = rng.normal(0, 2.2, (384,1536,1))
    image = Image.fromarray(np.clip(noise + [84,42,20],0,255).astype('uint8')).convert('RGBA')
    pen = ImageDraw.Draw(image)
    for n in range(3):
        x=n*512
        scan = Image.open(plates[(i+n)%len(plates)]).convert('L')
        # Restrict the exposure to the machinery engraving at the centre of each scan.
        w,h=scan.size
        crop = scan.crop((w*.14,h*.23,w*.86,h*.73))
        crop=ImageOps.fit(crop,(489,258))
        crop=ImageOps.autocontrast(crop,cutoff=4)
        plate=ImageOps.colorize(crop,(228,178,109),(44,27,21))
        image.paste(plate,(x+11,61))
        pen.text((x+113,12),member['handle'],font=font,fill='#f9cb86')
        pen.text((x+18,322),f'movrax60   •   {i+1:02d}   /   {n+1}A',font=tiny,fill='#f2be76')
        pen.polygon([(x+458,337),(x+474,331),(x+474,343)],fill='#d3a765')
        for k in range(4):
            for y in (9,355):
                left=x+k*128+15
                pen.rounded_rectangle((left,y,left+52,y+21),radius=5,fill=(0,0,0,0))
    image.save(OUT/f'strip-{i}.png',optimize=True)
