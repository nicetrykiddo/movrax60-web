"""Create eight registered ink plates for the movrax60 exposure study."""
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

folder = Path(__file__).resolve().parent
face = TTFont(folder.parents[2] / "public/fonts/3.woff2")
face.flavor = None
font_data = BytesIO()
face.save(font_data)
font_data.seek(0)
font = ImageFont.truetype(font_data, 384)

word = "movrax60"
width, height = 2400, 600
image = Image.new("L", (width, height))
draw = ImageDraw.Draw(image)
left, top, right, bottom = draw.textbbox((0, 0), word, font=font)
draw.text(((width - left - right) / 2, (height - top - bottom) / 2),
          word, fill=255, font=font)
ink = np.asarray(image)
y, x = np.ogrid[:height, :width]
# Vary the pitch along the guides so that one plate alone cannot reveal a letter.
guide = np.floor((x + 0.8*y + 32*np.sin(y/83 + x/360)) / 17).astype(int) % 8
registered = np.zeros_like(ink)
for index in range(8):
    alpha = np.where(guide == index, ink, 0).astype(np.uint8)
    assert alpha.any()
    registered = np.maximum(registered, alpha)
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    layer.putalpha(Image.fromarray(alpha))
    layer.save(folder / f"ink-{index+1}.png", optimize=True)
assert np.array_equal(registered, ink), "Registration changed the wordmark"
