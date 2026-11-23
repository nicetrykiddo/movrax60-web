"""Travel a single Cycles camera across the movrax60 bench, with two framings."""
import math
import os
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from scenes import (
    OUT, PLAYERS, SHOTS, HANDLES, badge, black, box, cam, contact, dark_metal,
    glow, key, kick, metal, mint, player, result, ring, scene, table, wire,
)

DEST = OUT.parent / 'journey'
GAP = 9.4
HOLD = 54
PASS = 34
VIEWS = os.getenv('JOURNEY_VIEWS','wide,tall').split(',')
route = os.getenv('JOURNEY_ROUTE','home')
steps = SHOTS if route=='home' else ['intro', *PLAYERS, 'contact']
detail = int(os.getenv('JOURNEY_STRIDE','2'))
long_shot = sorted(set(range(0,HOLD,detail)) | {HOLD-1})
travel_frames = sorted(set(range(0,PASS,detail)) | {PASS-1})

# All the fittings, power lines and lighting share a physical workbench.
box('Unbroken graphite workbench',(GAP*(len(steps)-1)*.5,0,-.87),(GAP*len(steps)+21,19,.48),table,.07)
for y in (-4.47,-4.37,4.1,4.18):
    box('Workbench relief',(GAP*(len(steps)-1)*.5,y,-.615),(GAP*len(steps)+15,.015,.007),dark_metal,.003)

pieces = []
for i,name in enumerate(steps):
    if name in ('intro','roster'):
        subject = badge()
    elif name in PLAYERS:
        order = PLAYERS.index(name)
        subject = player(HANDLES[order],order)
    elif name=='contact':
        subject = contact()
    else:
        subject = result(i-1)
    subject.location.x = i*GAP
    pieces.append(subject)

# Conduits and clamps move through the foreground as the camera crosses the bench.
for i in range(len(steps)-1):
    x = (i+.5)*GAP
    for j in range(4):
        y = (j-1.5)*.17 + .3*math.sin(i*1.37)
        wire('Braided interconnect',[(x-3.0,y+1.81,-.56),(x-1.9,y+1.38,-.54),(x-.92,y+.31,-.53),(x-.4,y-.11,-.53),(x+.56,y-.64,-.53),(x+2.9,y-1.38,-.57)],.035,mint if j==1 else black)
    coupler=box('Interconnect ferrule',(x+.04,-.20,-.552),(.38,1.06,.20),metal,.045)
    coupler.rotation_euler.z = .75
    dot=ring('Link indicator',(x+.05,-.20,-.446),.091,.012,glow)
    dot.scale.x=.78

def mix(a,b,t):
    return a+(b-a)*t

def sig(t):
    return t*t*(3-2*t)

def stage_pose(i,t,portrait):
    name=steps[i]
    is_player=name in PLAYERS
    order=PLAYERS.index(name) if is_player else i
    right=(order%2==0) if is_player else name not in ('roster','ritsec','chronos')
    x=i*GAP
    sx=math.sin(t*math.pi/2)
    pos=Vector((x+1.07-.59*sx,-3.35+t*.96,7.7-.86*t))
    focus=Vector((x+(-1.86 if right else 1.84),-.48,0))
    lens=42+t*3
    if portrait:
        focus=Vector((x-.20,-1.31,0))
        lens=39+t*2
    pivot = (order%3)*.25-.44 if is_player else order*.38-.70
    sweep=-.67 if name in ('contact','ritsec','chronos') else .73
    return pos,focus,lens,pivot+sweep*t

def expose(i,t,portrait,travelling):
    for k,subject in enumerate(pieces):
        local = t if k==i and not travelling else float(k<=i)
        subject.rotation_euler.z=stage_pose(k,local,portrait)[3]
        subject.location.z=.12*math.sin(local*math.pi)
    if travelling:
        prev=stage_pose(i,1,portrait)
        dest=stage_pose(i+1,0,portrait)
        motion=sig(t)
        arc=math.sin(math.pi*motion)
        pos=prev[0].lerp(dest[0],motion)
        pos.z-=2.45*arc
        pos.y+=.54*arc
        focus=prev[1].lerp(dest[1],motion)
        lens=mix(prev[2],dest[2],motion)-4*arc
    else:
        pos,focus,lens,_=stage_pose(i,t,portrait)
        arc=0
    cam.location=pos
    cam.rotation_euler=(focus-pos).to_track_quat('-Z','Y').to_euler()
    cam.data.lens=lens
    key.location.x=pos.x-2.4
    key.rotation_euler=(Vector((focus.x,0,0))-key.location).to_track_quat('-Z','Y').to_euler()
    kick.location.x=pos.x+3.7
    kick.rotation_euler=(Vector((focus.x,0,0))-kick.location).to_track_quat('-Z','Y').to_euler()
    kick.data.energy=180+90*arc
    bpy.data.objects['Overhead cloth'].location.x=pos.x-1.0

only = os.getenv('JOURNEY_SHOTS','').split(',')
for view in VIEWS:
    portrait = view=='tall'
    scene.render.resolution_x = 720 if portrait else 1224
    scene.render.resolution_y = 960 if portrait else 786
    scene.render.resolution_percentage = int(os.getenv('JOURNEY_SCALE','100' if detail >= 4 else '54'))
    scene.cycles.samples = int(os.getenv('JOURNEY_SAMPLES','12'))
    for i,name in enumerate(steps):
        if only!=[''] and name not in only:continue
        for travel,count,indices in [(False,HOLD,long_shot),(True,PASS,travel_frames)]:
            if travel and i+1==len(steps):continue
            folder = DEST/route/view/(name+'-to' if travel else name)
            folder.mkdir(parents=True,exist_ok=True)
            for index in indices:
                output = folder / f'{index:03}.webp'
                if output.exists() and output.stat().st_size > 0:
                    continue
                expose(i,index/(count-1),portrait,travel)
                scene.render.filepath=str(output)
                bpy.ops.render.render(write_still=True)
