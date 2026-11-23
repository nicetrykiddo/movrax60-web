"""Package 30 preview exposures for instant, reversible turns on slower connections."""
from pathlib import Path
from PIL import Image

frames = Path(__file__).resolve().parents[2] / 'public/pin'
tile = 384
atlas = Image.new('RGBA', (tile * 6, tile * 5))
for index, frame in enumerate(range(0, 120, 4)):
    with Image.open(frames / f'{frame:03}.webp') as source:
        resized = source.convert('RGBA').resize((tile, tile), Image.Resampling.LANCZOS)
    atlas.paste(resized, ((index % 6)*tile, (index//6)*tile))
atlas.save(frames / 'orbit.webp', quality=84, method=6)
