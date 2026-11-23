"""Render an original 32-second synth loop for the enamel-pin site."""
from pathlib import Path
import subprocess

import numpy as np
from scipy.signal import butter, sosfilt

rate = 44100
seconds = 32
time = np.arange(rate * seconds) / rate
rng = np.random.default_rng(198036)
noise = rng.normal(0, 0.026, len(time))
filtered = sosfilt(butter(2, [180, 2550], 'bandpass', fs=rate, output='sos'), noise)
left, right = filtered.copy(), filtered.copy()
for i, frequency in enumerate((55, 82.5, 110, 164.875, 220.125)):
    position = 2*np.pi*(time/seconds * (i%2+1) + i*.13)
    envelope = (0.52 + .48*np.cos(position))**2
    tone = 2*np.pi*frequency*time + .72*np.sin(position)
    voice = np.sin(tone) + np.sin(tone*2.0 + .21)*.19
    gain = (.078 if i in (0,1) else .037) * envelope
    left += voice * gain * (.88 + (i%2)*.25)
    right += (voice*.71 + np.sin(tone+.51)*.31) * gain * (1.02 - (i%2)*.16)
fade = np.minimum(np.clip(time/.23, 0, 1), np.clip((seconds-time)/.23, 0, 1))
samples = np.column_stack((left*fade, right*fade)).astype('<f4').tobytes()
destination = Path(__file__).resolve().parents[2] / 'public/audio/ambient.mp3'
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(rate),'-ac','2','-i','pipe:0','-codec:a','libmp3lame','-b:a','96k',str(destination)], input=samples, check=True)
