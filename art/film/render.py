"""Render The Last Exposure. Run blender -b -P art/film/render.py
Frames 0..39: the projector; 40..83: the transport; 84..127: registration.
Set FILM_FRAMES to comma-separated indices for a contact sheet.
"""
import bpy
import math
import os
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT/'art/library'
OUT = Path(os.getenv('FILM_OUT', str(ROOT/'public/film')))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(os.getenv('FILM_SAMPLES', '12'))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.cycles.transparent_max_bounces = 16
scene.render.use_persistent_data = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'OPTIX'
    prefs.refresh_devices()
    for d in prefs.devices: d.use = d.type == 'OPTIX'
    if any(d.use for d in prefs.devices):
        scene.cycles.device = 'GPU'
        scene.cycles.denoising_use_gpu = True
        scene.cycles.denoiser = 'OPTIX'
except (TypeError, RuntimeError):
    pass

world=bpy.data.worlds.new('Dark projection booth');scene.world=world;world.use_nodes=True
wn=world.node_tree.nodes
env=wn.new('ShaderNodeTexEnvironment')
env.image=bpy.data.images.load(str(LIB/'lighting/small_workshop/hdri.hdr'))
world.node_tree.links.new(env.outputs['Color'],wn['Background'].inputs['Color'])
wn['Background'].inputs['Strength'].default_value=.16
# Camera rays see the unlit room rather than the lighting panorama.
dark=wn.new('ShaderNodeBackground');dark.inputs[0].default_value=(.003,.004,.006,1)
mix=wn.new('ShaderNodeMixShader');ray=wn.new('ShaderNodeLightPath')
for a,b in [(ray.outputs['Is Camera Ray'],mix.inputs[0]),(wn['Background'].outputs[0],mix.inputs[1]),(dark.outputs[0],mix.inputs[2]),(mix.outputs[0],wn['World Output'].inputs[0])]:world.node_tree.links.new(a,b)
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='WEBP'
scene.render.image_settings.quality=82
scene.render.resolution_percentage=int(os.getenv('FILM_SCALE','100'))

def mat(name,color,rough=.4,metal=0,emission=0,wear=None):
    m=bpy.data.materials.new(name);m.use_nodes=True
    ns=m.node_tree.nodes;links=m.node_tree.links;p=ns['Principled BSDF']
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if wear:
        tex=ns.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(wear),check_existing=True);tex.image.colorspace_settings.name='Non-Color'
        coord=ns.new('ShaderNodeTexCoord');tex.projection='BOX';tex.projection_blend=.16;links.new(coord.outputs['Object'],tex.inputs[0])
        scale=ns.new('ShaderNodeMapRange');scale.inputs['To Min'].default_value=rough*.7;scale.inputs['To Max'].default_value=min(1,rough+.36)
        links.new(tex.outputs[0],scale.inputs[0]);links.new(scale.outputs[0],p.inputs['Roughness'])
        bump=ns.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.008
        links.new(tex.outputs[0],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
    return m

def area(name,pos,target,power,color,size,sy=None):
    lamp=bpy.data.lights.new(name,'AREA');lamp.energy=power;lamp.color=color;lamp.shape='RECTANGLE';lamp.size=size;lamp.size_y=sy or size
    o=bpy.data.objects.new(name,lamp);scene.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o

def finish(o,name,m,bevel):
    o.name=name;o.data.materials.append(m)
    if bevel:
        be=o.modifiers.new('Machined edge','BEVEL');be.width=bevel;be.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def box(name,pos,dims,m,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object
    o.dimensions=dims;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,bevel)
def cyl(name,pos,radius,depth,m,axis=(0,-1,0),bevel=.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=pos)
    o=bpy.context.object;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return finish(o,name,m,bevel)
def rod(name,a,b,r,m):
    a,b=Vector(a),Vector(b)
    return cyl(name,(a+b)*.5,r,(b-a).length,m,b-a)
def torus(name,pos,r,small,m,axis=(0,-1,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=80,minor_segments=8,major_radius=r,minor_radius=small,location=pos)
    o=bpy.context.object;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler();o.name=name;o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o
def label(text,pos,size,m):
    cu=bpy.data.curves.new(text,'FONT');cu.body=text;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.0006
    o=bpy.data.objects.new(text,cu);scene.collection.objects.link(o);o.location=pos;o.rotation_euler.x=math.pi/2;cu.materials.append(m)
def parent(o,p):
    bpy.context.view_layer.update()
    world=o.matrix_world.copy()
    o.parent=p;o.matrix_world=world
def group(name,pos):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=pos;return o

wear=next((LIB/'surface/Scratches005').glob('*Opacity*'))
steel=mat('Turned nickel',(.52,.54,.55),.21,.93,wear=wear)
brass=mat('Oiled brass',(.62,.36,.102),.23,.86,wear=wear)
enamel=mat('Wrinkle-black enamel',(.027,.034,.031),.35,.65,wear=LIB/'materials/metal_plate_02/rough.jpg')
black=mat('Gate black',(.009,.011,.012),.29,.52)
rubber=mat('Vulcanized rubber',(.013,.012,.010),.7,wear=LIB/'materials/rubber_tiles/rough.jpg')
cream=mat('Oxidized ivory lettering',(.73,.64,.43),.44)
glass=mat('Optical coating',(.23,.114,.047),.095,.86)
bulb=mat('Lamp filament', (1,.57,.21),.22,0,3)
base=mat('Bench',(.046,.040,.029),.52,.25,wear=LIB/'materials/metal_plate_02/rough.jpg')
# Real diffuse scans break up the machined surfaces under the narrow key.
def patina(m, image_path, amount, size):
    ns=m.node_tree.nodes;lk=m.node_tree.links;p=ns['Principled BSDF']
    im=ns.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(image_path),check_existing=True);im.projection='BOX';im.projection_blend=.12
    uv=ns.new('ShaderNodeTexCoord');scale=ns.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs['Scale'].default_value=size
    lk.new(uv.outputs['Object'],scale.inputs[0]);lk.new(scale.outputs[0],im.inputs[0])
    mix=ns.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=amount;mix.inputs[1].default_value=p.inputs['Base Color'].default_value[:]
    lk.new(im.outputs['Color'],mix.inputs[2]);lk.new(mix.outputs[0],p.inputs['Base Color'])
patina(enamel,LIB/'materials/rusty_painted_metal/diffuse.jpg',.12,.68)
patina(base,LIB/'materials/metal_plate_02/diffuse.jpg',.28,.28)
plaster=mat('Projection room plaster',(.055,.057,.052),.85,wear=LIB/'materials/grey_plaster_02/nor_gl.jpg')
patina(plaster,LIB/'materials/grey_plaster_02/diffuse.jpg',.22,.19)
box('Booth rear wall',(0,4.8,4),(31,.45,9),plaster,.018)
# Concrete mullions and a high frosted observation slot give the room depth.
for x in (-6.3,-4.6,-2.9,-1.2,.5,2.2):
    box('Window pane',(x,4.52,4.82),(1.60,.09,1.25),glass,.005)
    box('Window reveal',(x,4.46,4.16),(1.72,.16,.065),steel,.008)
for x in (-5.9,-2.2,1.5,5.2):
    rod('Conduit',(x,4.50,-.1),(x,4.50,8.3),.033,black)
for x in (1.92,2.12):
    rod('Back wall pipes',(x,4.29,-.1),(x,4.29,8),.067,enamel)
    for z in (.9,3.0,5.1):cyl('Pipe collar',(x,4.29,z),.082,.078,steel,(0,0,1))
# Physical projector, with two slotted reel flanges, concentric spools and a knurled lens.
box('Workbench',(0,1,-.19),(32,18,.36),base,.12)
box('Pedestal',(0,0,.20),(3.15,1.95,.28),black,.12)
box('Enamel chassis',(.13,.1,1.14),(3,1.32,1.7),enamel,.18)
box('Removable inspection cover',(.22,-.60,1.14),(2.52,.14,1.38),enamel,.095)
for x in (-.93,1.37):
    for z in (.56,1.72):
        cyl('Slotted screw',(x,-.685,z),.045,.025,steel)
        box('Screw slot',(x,-.703,z),(.057,.007,.007),black,.001)
for i in range(14):
    box('Cast vent',(.38+i*.071,-.679,1.42),(.029,.025,.35),black,.012)
box('Identification plate',(-.36,-.70,.99),(.92,.025,.31),brass,.018)
label('movrax60',(-.36,-.721,.993),.155,black)
cyl('Speed dial',(.78,-.75,.81),.22,.18,black)
torus('Dial bezel',(.78,-.846,.81),.19,.018,brass)
for i in range(13):
    a=-2.2+i*4.4/12
    box('Dial index',(.78+math.sin(a)*.258,-.704,.81+math.cos(a)*.258),(.012,.012,.040),cream,.001).rotation_euler.y=a
# Threaded focusing cylinder points over the lefthand edge of the bench.
axis=Vector((-.88,-.43,.09)).normalized()
mount=Vector((-1.18,-.11,1.31))
for offset,r,d,m in [(0,.48,.54,enamel),(.35,.355,.33,brass),(.63,.34,.35,black),(.85,.37,.18,steel),(.96,.32,.11,black)]:
    cyl('Lens barrel',mount+axis*offset,r,d,m,axis)
for i in range(14):torus('Focusing groove',mount+axis*(.44+i*.029),.342,.014,brass,axis)
for i in range(4):cyl('Coated objective',mount+axis*(1.01+i*.009),.282-i*.022,.014,glass if i%2==0 else brass,axis,.002)
cyl('Warm aperture',mount+axis*1.05,.19,.01,bulb,axis,.001)

reels=[]
def build_reel(x,z,r):
    pivot=group('Reel spindle',(x,-.12,z));reels.append(pivot)
    rod('Support arm',(x*.32,.36,1.80),(x,.36,z),.115,enamel)
    for y in (.10,-.36):
        # A solid rim and seven stamped spokes leave open windows through the flange.
        torus('Rolled steel rim',(x,y,z),r,.037,steel)
        torus('Stamped inner bead',(x,y,z),r-.075,.012,brass)
        hub=cyl('Hub',(x,y,z),r*.31,.064,steel);parent(hub,pivot)
        for i in range(7):
            a=2*math.pi*i/7
            spoke=box('Pressed flange spoke',(x+math.sin(a)*r*.63,y,z+math.cos(a)*r*.63),(r*.205,.071,r*.72),steel,.032)
            spoke.rotation_euler.y=a;parent(spoke,pivot)
    cyl('Wound emulsion',(x,-.125,z),r*.83,.36,mat('Dark wound film',(.068,.039,.02),.28,.38))
    for i in range(23):torus('Visible film layers',(x,-.316,z),r*(.32+i*.022),.0038,brass if i%6==0 else black)
    cyl('Axle cap',(x,-.435,z),r*.167,.14,brass)
    cyl('Axle button',(x,-.522,z),r*.076,.043,black)
build_reel(-1.00,3.04,1.02);build_reel(1.09,3.40,1.19)
for x,z in [(-1.28,2.1),(-.63,1.89),(1.29,2.16)]:
    cyl('Transport idler',(x,-.13,z),.145,.36,brass)
    for y in (-.325,.060):cyl('Idler flange',(x,y,z),.19,.022,steel)
area('Warm skimming key',(-2,1,5),(0,0,1.6),630,(1,.69,.36),3.3,.65)
area('Cool strip behind reels',(4,2,4),(0,0,2.4),730,(.53,.74,1),3.7,.7)
area('Negative fill edge',(-3,-4,3),(0,0,2),140,(.92,.84,.70),3,1)
area('Lamp bounce',(-2,-.8,1.6),(-4,-2,.0),60,(1,.46,.15),.7)
# Two small physical belts bridge the reels and the feed rollers.
for a,b in [((-1.89,-.1,2.83),(-1.37,-.1,2.08)),((1.97,-.1,3.53),(1.4,-.1,2.17))]:
    mid=(Vector(a)+Vector(b))*.5;vec=Vector(b)-Vector(a)
    o=box('Taut film feed',mid,(.012,.24,vec.length),black,.004);o.rotation_euler=vec.to_track_quat('Z','Y').to_euler()
# Volumetric light shaft: a cone widening from the physical aperture.
beam_start=mount+axis*1.07
beam_length=6.8
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.17,radius2=1.15,depth=beam_length,location=beam_start+axis*beam_length*.5)
beam=bpy.context.object;beam.name='Dust in projected lamplight';beam.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
haze=bpy.data.materials.new('Warm airborne haze');haze.use_nodes=True
hn=haze.node_tree.nodes;hn.remove(hn['Principled BSDF']);vol=hn.new('ShaderNodeVolumePrincipled')
vol.inputs['Density'].default_value=.017;vol.inputs['Emission Strength'].default_value=.075;vol.inputs['Emission Color'].default_value=(.89,.45,.14,1)
haze.node_tree.links.new(vol.outputs[0],hn['Material Output'].inputs['Volume']);beam.data.materials.append(haze)
rng=random.Random(24579)
dustverts=[];dustfaces=[]
for i in range(370):
    p=beam_start+axis*rng.uniform(.15,5.4)+Vector((0,rng.gauss(0,.13),rng.gauss(0,.16)))
    r=rng.uniform(.0009,.004)
    j=len(dustverts)
    dustverts.extend([tuple(p+Vector(v)*r) for v in ((-1,0,-1),(1,0,-1),(0,0,1))]);dustfaces.append((j,j+1,j+2))
dm=bpy.data.meshes.new('Dust');dm.from_pydata(dustverts,[],dustfaces)
dust=bpy.data.objects.new('Particles caught by the beam',dm);scene.collection.objects.link(dust);dm.materials.append(bulb)

def ribbon_material(i):
    m=mat('Developed acetate '+str(i),(.2,.08,.02),.245,.24)
    ns=m.node_tree.nodes;lk=m.node_tree.links
    im=ns.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(ROOT/'art/film/stock'/f'strip-{i}.png'))
    vm=ns.new('ShaderNodeVectorMath');vm.operation='ADD'
    uv=ns.new('ShaderNodeTexCoord');lk.new(uv.outputs['UV'],vm.inputs[0]);lk.new(vm.outputs[0],im.inputs[0])
    p=ns['Principled BSDF'];lk.new(im.outputs['Color'],p.inputs['Base Color']);lk.new(im.outputs['Alpha'],p.inputs['Alpha'])
    p.inputs['Coat Weight'].default_value=.37;p.inputs['Coat Roughness'].default_value=.19
    lk.new(im.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.19
    return m,vm

# A separate close-focus transport set allows larger film detail without losing fidelity.
OX=28
ribbons=[]
steps=57
def ribbon_shape(i,t):
    coords=[]
    band=i-3.5
    for j in range(steps+1):
        x=j/steps*16-8
        phase=x*.55+i*.38-t*1.3
        z=1.95+band*.32+math.sin(phase)*(.39+.035*i)+.055*x
        y=band*.39+.48*math.sin(x*.47+i*.55+t*.42)
        twist=.56*math.sin(x*.47+i*.29-t*.55)+.32
        for edge in (-1,1):
            coords.append((OX+x,y+edge*.43*math.sin(twist),z+edge*.43*math.cos(twist)))
    return coords
for i in range(8):
    faces=[(j*2,j*2+2,j*2+3,j*2+1) for j in range(steps)]
    me=bpy.data.meshes.new('Ribbon surface');me.from_pydata(ribbon_shape(i,0),[],faces);me.update()
    uv=me.uv_layers.new()
    for p in me.polygons:
        p.use_smooth=True
        for li in p.loop_indices:
            v=me.loops[li].vertex_index;uv.data[li].uv=((v//2)/steps*4,v%2)
    obj=bpy.data.objects.new('Threaded exposure '+str(i+1),me);scene.collection.objects.link(obj)
    stock,offset=ribbon_material(i);me.materials.append(stock);ribbons.append((me,offset))
for x in (-5.4,4.8):
    for i in range(4):
        y=(i-1.5)*.77;z=1.85+(i-1.5)*.56
        cyl('Precision guide roller',(OX+x,y+.24,z),.255,.46,brass)
        for tip in (-.01,.485):cyl('Roller lip',(OX+x,y+tip,z),.30,.023,steel)
box('Black transport bed',(OX,2.4,2.6),(34,.38,16),enamel,.11)
for z in (-1.2,-.4,4.3,5.2):
    rod('Machined rail',(OX-11,1.9,z),(OX+11,1.9,z),.08,steel)
for x in (-5,-2,1,4,7):
    for z in (-.8,4.15):
        cyl('Rail fixing',(OX+x,1.97,z),.055,.23,brass)
area('Acetate backlight',(OX+2,1.50,4.5),(OX,0,1.8),550,(1,.67,.32),7,.50)
area('Raking light over print',(OX-3,-3.5,4.4),(OX,0,2.0),480,(.90,.81,.63),5,1)
area('Upper edge reflection',(OX+6,-1,4),(OX+1,0,1),380,(.64,.76,.91),3.0,.4)

# The last gate is practical back-lit glass. Eight independent transparent negatives
# overlap physically; their partial ink textures form one word only at registration.
GX=54
box('Gate housing',(GX,.42,2.3),(12,.6,6.8),enamel,.13)
box('Aperture brass inset',(GX,.075,2.4),(6.62,.14,2.08),brass,.09)
box('Inner bevel',(GX,-.015,2.4),(6.39,.09,1.88),black,.048)
opal=mat('Opal glass',(.82,.70,.44),.37,0,1.4)
box('Illuminated aperture',(GX,-.09,2.4),(6.19,.06,1.69),opal,.04)
for x in (-3.18,3.18):
    for z in (1.52,3.28):
        cyl('Retaining screw',(GX+x,-.015,z),.048,.055,steel)
        box('Driver cut',(GX+x,-.048,z),(.071,.011,.008),black,.001)
inks=[]
for i in range(8):
    w,h=6.0,1.50
    vertices=[(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)]
    me=bpy.data.meshes.new('Optical carrier');me.from_pydata(vertices,[],[(0,1,2,3)]);me.update()
    uv=me.uv_layers.new()
    for j,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[j].uv=co
    ob=bpy.data.objects.new('Registration plate '+str(i+1),me);scene.collection.objects.link(ob);inks.append(ob)
    m=mat('Ink separation '+str(i),(.011,.007,.005),.53);im=m.node_tree.nodes.new('ShaderNodeTexImage')
    im.image=bpy.data.images.load(str(LIB/'generated'/f'ink-{i+1}.png'))
    m.node_tree.links.new(im.outputs['Alpha'],m.node_tree.nodes['Principled BSDF'].inputs['Alpha']);me.materials.append(m)
    ob.location=(GX,-.13-i*.006,2.4)
for z in (1.12,3.66):
    rod('Registration rail',(GX-5,-.06,z),(GX+5,-.06,z),.068,steel)
for x in (-3.7,3.7):
    cyl('Capstan',(GX+x,-.08,2.4),.29,.42,steel)
    cyl('Capstan centre',(GX+x,-.31,2.4),.14,.08,brass)
label('OPTICAL REGISTRATION',(GX,-.005,1.34),.068,cream)
area('Gate reflection',(GX-2,-2.3,5),(GX,0,2.3),240,(1,.66,.32),4,.55)
area('Rail edge',(GX+4,-1.2,4),(GX+2,0,2.3),160,(.63,.77,1),3,.35)

bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.clip_end=100
cam.data.dof.use_dof=True;cam.data.dof.aperture_fstop=2.8;cam.data.dof.aperture_blades=7
bpy.context.view_layer.update()
set_members=([],[],[])
for obj in scene.objects:
    if obj.type not in ('LIGHT','MESH','FONT'):continue
    x=obj.matrix_world.translation.x
    set_members[2 if x>40 else 1 if x>15 or obj.name.startswith('Threaded exposure') else 0].append(obj)
last_set=None
# A real foreground flag wipes the lens at the two edit points.
blade=box('Out-of-focus shutter flag',(0,0,0),(4,.95,.045),black,.016)
blade.parent=cam
blade.rotation_euler.z=.24
scene.cycles.use_camera_cull=False
def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)
def camera(pos,look,focal,focus):
    cam.location=pos;cam.rotation_euler=(Vector(look)-Vector(pos)).to_track_quat('-Z','Y').to_euler()
    cam.data.lens=focal;cam.data.dof.focus_distance=(Vector(focus)-Vector(pos)).length

def pose(f,portrait):
    global last_set
    current=0 if f<40 else 1 if f<84 else 2
    if current!=last_set:
        for i,group_objects in enumerate(set_members):
            for obj in group_objects:obj.hide_render=i!=current
        last_set=current
    distance=min(abs(f-39.5),abs(f-83.5))
    blade.hide_render=distance>=4
    blade.location=(0,max(0,distance-.5)*.26,-.70)
    if f<40:
        t=ease(f/39)
        for i,r in enumerate(reels):r.rotation_euler.y=(1 if i else -1)*t*2.55
        pos=lerp((-5.6,-10.8,4.25),(-2.65,-4.4,2.70),t)
        aim=lerp((-.04,0,2.35) if portrait else (-1.71,0,2.26),(-1.21,-.04,1.62),t)
        camera(pos,aim,(48 if portrait else 45)+t*6,(-.45,-.33,2.12))
    elif f<84:
        t=(f-40)/43
        for i,(mesh,offset) in enumerate(ribbons):
            mesh.vertices.foreach_set('co',[c for vertex in ribbon_shape(i,t) for c in vertex])
            mesh.update();offset.inputs[1].default_value[0]=t*(.45+i*.041)
        pos=lerp((OX-6,-4.65,3.6),(OX+2.2,-5.1,2.31),ease(t))
        aim=lerp((OX-.7,0,2.02),(OX+3.7,.28,2.18),ease(t))
        camera(pos,aim,40 if portrait else 39,aim)
    else:
        t=ease((f-84)/40)
        for i,ob in enumerate(inks):
            shift=(1-t);a=i*2.39996
            ob.location=(GX+math.cos(a)*shift*.96,-.13-i*.006-shift*i*.083,2.4+math.sin(a)*shift*.49)
            ob.rotation_euler.y=math.sin(a+.65)*shift*.24
        pos=lerp((GX-3.35,-5.2,3.5),(GX,-9.1 if portrait else -8.3,2.42),t)
        aim=lerp((GX-.44,0,2.4),(GX if portrait else GX-.72,0,2.08),t)
        camera(pos,aim,30 if portrait else 36,(GX,-.2,2.4))
    cam.data.shift_y=(.085 if portrait else .02)*-1 if f<40 else (-.10 if portrait else 0)

keys=[0,62,127,20,35,39,40,50,74,83,84,96,112]
frames=([int(x) for x in os.environ['FILM_FRAMES'].split(',')] if 'FILM_FRAMES' in os.environ
        else list(dict.fromkeys(keys+list(range(128)))))
views=os.getenv('FILM_VIEWS','wide,tall').split(',')
for segment in [frames[:3], frames[3:]]:
    for orientation,f in ((orientation,f) for orientation in views for f in segment):
        portrait=orientation=='tall'
        scene.render.resolution_x=768 if portrait else 1440
        scene.render.resolution_y=1024 if portrait else 864
        (OUT/orientation).mkdir(parents=True,exist_ok=True)
        pose(f,portrait)
        target=OUT/orientation/f'{f:03}.webp'
        scene.render.filepath=str(target)
        bpy.ops.render.render(write_still=True)
        print('FRAME',orientation,f,flush=True)
