"""Pack Cycles exposures and optical-flow in-betweens for smooth scroll playback."""
from argparse import ArgumentParser
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

parser = ArgumentParser()
parser.add_argument('--route', choices=('home', 'members'))
parser.add_argument('--force', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2] / 'public/journey'
cv2.setNumThreads(2)

def bridge(first, second, steps):
    rgb_a = np.asarray(first)
    rgb_b = np.asarray(second)
    a = cv2.cvtColor(rgb_a, cv2.COLOR_RGB2GRAY)
    b = cv2.cvtColor(rgb_b, cv2.COLOR_RGB2GRAY)
    params = (.5, 4, 23, 3, 5, 1.2, 0)
    forward = cv2.calcOpticalFlowFarneback(a, b, None, *params)
    reverse = cv2.calcOpticalFlowFarneback(b, a, None, *params)
    yy, xx = np.indices(a.shape, dtype=np.float32)
    coordinates = np.stack((xx, yy), axis=-1)
    for step in range(1, steps):
        fraction = step / steps
        warped_a = cv2.remap(rgb_a, coordinates - forward*fraction, None, cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)
        warped_b = cv2.remap(rgb_b, coordinates - reverse*(1-fraction), None, cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)
        yield Image.fromarray(cv2.addWeighted(warped_a, 1-fraction, warped_b, fraction, 0))

for route in root.glob(args.route or '*'):
    for view in route.glob('*'):
        tile = (384, 247) if view.name=='wide' else (300, 400)
        for sequence in sorted(view.iterdir()):
            candidates = sorted(sequence.glob('[0-9][0-9][0-9].webp'))
            total = 34 if sequence.name.endswith('-to') else 54
            target = sequence/'preview.webp'
            if len(candidates) < 8:
                continue
            if target.exists() and not args.force and target.stat().st_mtime > max(p.stat().st_mtime for p in candidates):
                continue
            atlas = Image.new('RGB', (tile[0]*6, tile[1]*((total+5)//6)))
            previous = None
            previous_index = 0

            def paste(frame, index):
                atlas.paste(frame, (index%6*tile[0], index//6*tile[1]))

            for path in candidates:
                index = int(path.stem)
                try:
                    with Image.open(path) as raw:
                        image = raw.convert('RGB').resize(tile, Image.Resampling.LANCZOS)
                except OSError:
                    continue
                if previous is not None and index - previous_index > 1:
                    for inner, estimated in enumerate(bridge(previous,image,index-previous_index), previous_index+1):
                        paste(estimated,inner)
                paste(image,index)
                previous, previous_index = image, index
            if previous is None:
                continue
            for index in range(previous_index+1,total):
                paste(previous,index)
            output = sequence/'preview.tmp.webp'
            atlas.save(output,quality=87,method=4)
            output.replace(target)
            print(target.relative_to(root),flush=True)
