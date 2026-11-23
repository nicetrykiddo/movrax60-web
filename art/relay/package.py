"""Package the full-resolution scroll film and exact-pose stills."""
import os
from argparse import ArgumentParser
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('RELAY_OUT', '/tmp/relay-frames'))
OUTPUT = ROOT / 'public/relay'
PACKAGED = {
    'entrance': {'entrance':0},
    'interior': {'roster':13,'salt':62,'nullcon':94},
    'passage': {'ritsec':31,'script':74},
    'contact': {'chronos':23,'contact':71}
}

parser=ArgumentParser()
parser.add_argument('--shots',default=','.join(PACKAGED))
args=parser.parse_args()
(OUTPUT/'posters').mkdir(parents=True,exist_ok=True)
for view in ['wide','tall']:
    (OUTPUT/view).mkdir(parents=True,exist_ok=True)
    for shot in args.shots.split(','):
        temp=OUTPUT/view/f'{shot}.tmp.mp4'
        target=OUTPUT/view/f'{shot}.mp4'
        subprocess.run([
            'ffmpeg','-hide_banner','-loglevel','error','-y',
            '-threads','4','-framerate','30','-i',str(SRC/view/shot/'%03d.webp'),
            '-an','-c:v','libx264','-preset','veryfast','-crf','20',
            '-pix_fmt','yuv420p','-g','6','-keyint_min','6','-sc_threshold','0','-bf','0',
            '-flags','+cgop','-movflags','+faststart','-threads','4',str(temp),
        ],check=True)
        temp.replace(target)
        for name,frame in PACKAGED[shot].items():
            shutil.copyfile(SRC/view/shot/f'{frame:03}.webp',OUTPUT/'posters'/f'{name}-{view}.webp')
        print(view,shot,round(target.stat().st_size/1e6,2),'MB',flush=True)
