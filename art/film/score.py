"""Mix the licensed projection-room recording with an original three-note score."""
import subprocess
from pathlib import Path
import numpy as np

root = Path(__file__).resolve().parents[2]
rate = 44100
duration = 24
time = np.arange(rate * duration) / rate
# Whole cycles over the loop keep the oscillators phase-continuous.
score = np.zeros_like(time)
for index, frequency in enumerate((98, 147, 196)):
    envelope = (.5 - .5 * np.cos(2*np.pi*(time/duration + index/3))) ** 2
    wave = np.sin(2*np.pi*frequency*time) + .14*np.sin(2*np.pi*frequency*3*time)
    score += .052 * envelope * wave
fade = np.minimum(np.clip(time/.5, 0, 1), np.clip((duration-time)/.5, 0, 1))
pcm = np.asarray(score*fade, dtype='<f4').tobytes()
source = root/'art/library/sound/cinema-projector.mp3'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','4','-t',str(duration),
                '-i',str(source),'-f','f32le','-ar',str(rate),'-ac','1','-i','pipe:0',
                '-filter_complex','[0:a]highpass=f=75,lowpass=f=5200,volume=0.65,afade=t=in:d=0.45,afade=t=out:st=23.4:d=0.6[room];[room][1:a]amix=inputs=2:normalize=0',
                '-ac','1','-codec:a','libmp3lame','-b:a','96k',str(root/'public/audio/transport.mp3')],
               input=pcm,check=True)
