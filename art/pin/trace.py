"""Trace the supplied mascot into a shared outline and raised enamel islands."""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

here = Path(__file__).resolve().parent
source = Image.open(here / "original.png").convert("RGB")
ink = np.asarray(source.convert("L")) > 120
solid = ndimage.binary_fill_holes(ndimage.binary_closing(ink, iterations=10))
labels, count = ndimage.label(solid)
solid = labels == np.argmax(np.bincount(labels.ravel())[1:]) + 1
outer = ndimage.binary_dilation(solid, iterations=7)
with tempfile.TemporaryDirectory() as tmp:
    for name, mask in (("outline", outer), ("enamel", ink & solid)):
        path = Path(tmp) / "mask.pbm"
        Image.fromarray(~mask).save(path)
        geo = subprocess.check_output(["potrace", "-b", "geojson", "-t", "16", "-O", ".45", "-o", "-", str(path)])
        data = json.loads(geo)
        polygons = [a["geometry"]["coordinates"] for a in data["features"]]
        (here / (name + ".json")).write_text(json.dumps(polygons, separators=(",", ":")))

# A compact raster preserves the drawing in tabs, navigation and shared previews.
icon = source.convert("RGBA")
icon.putalpha(Image.fromarray((solid * 255).astype('uint8')))
icon = icon.crop(icon.getbbox())
icon.thumbnail((144,144),Image.Resampling.LANCZOS)
icon.save(here.parents[1] / "public/mascot.png", optimize=True)
