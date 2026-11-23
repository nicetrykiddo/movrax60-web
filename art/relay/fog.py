"""A feathered density mask for the near-camera haze."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, zoom

root = Path(__file__).resolve().parents[2]
rng = np.random.default_rng(624)
height, width = 480, 1536
density = np.zeros((height,width))
for rows, cols, gain in [(4, 8, .58),(10, 26, .27),(30, 75, .12),(90, 230, .032)]:
    noise = rng.random((rows,cols))
    density += zoom(noise, (height/rows,width/cols), order=3)[:height,:width]*gain
y, x = np.mgrid[0:1:height*1j,0:1:width*1j]
envelope = np.clip(np.sin(x*np.pi),0,1)**.62 * np.sin(y*np.pi)**1.5
mask = gaussian_filter(np.maximum(0, density-.30)**.86*envelope, 5.5)
rgba = np.zeros((height,width,4),dtype='uint8')
rgba[:,:,:3] = [246,214,175]
rgba[:,:,3] = np.round(np.clip(mask*290,0,255))
Image.fromarray(rgba).save(root/'public/relay/mist.webp', quality=87)
