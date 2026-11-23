"""Package all 120 exposures for instant, reversible turns on slower connections."""
from pathlib import Path
from PIL import Image

frames = Path(__file__).resolve().parents[2] / 'public/pin'
tile = 288
atlas = Image.new('RGBA', (tile * 12, tile * 10))
for index, frame in enumerate(range(120)):
    with Image.open(frames / f'{frame:03}.webp') as source:
        resized = source.convert('RGBA').resize((tile, tile), Image.Resampling.LANCZOS)
    atlas.paste(resized, ((index % 12)*tile, (index//12)*tile))
atlas.save(frames / 'orbit.webp', quality=84, method=6)
