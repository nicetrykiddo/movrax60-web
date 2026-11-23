"""Raking studio light on black technical knit for the team site."""
import bpy, math
from pathlib import Path
from mathutils import Vector
here=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=20
scene.cycles.use_denoising=True
p=bpy.context.preferences.addons['cycles'].preferences
try:
    p.compute_device_type='OPTIX';p.refresh_devices()
    for d in p.devices:d.use=d.type=='OPTIX'
    if any(d.use for d in p.devices):scene.cycles.device='GPU'
except (TypeError,RuntimeError):pass
world=bpy.data.worlds.new('Black studio');scene.world=world;world.color=(.055,.055,.055)
def form(x,y):
    t=x*.76-y*.52
    return .35*math.sin(t*1.43)+.20*math.sin(t*2.27+x*.17)+.09*math.sin(y*.84+x*.2)
verts=[];faces=[]
for j in range(121):
    for i in range(191):
        x=(i-95)*.09;y=(j-60)*.10
        verts.append((x,y,form(x,y)))
        if i and j:
            n=len(verts)-1;faces.append((n-192,n-191,n,n-1))
me=bpy.data.meshes.new('Draped team jersey');me.from_pydata(verts,[],faces);me.update()
cloth=bpy.data.objects.new('Technical knit',me);scene.collection.objects.link(cloth)
for face in me.polygons:face.use_smooth=True
mat=bpy.data.materials.new('Anthracite double knit');mat.use_nodes=True;me.materials.append(mat)
ns=mat.node_tree.nodes;lk=mat.node_tree.links;shader=ns['Principled BSDF']
shader.inputs['Base Color'].default_value=(.053,.059,.06,1)
shader.inputs['Roughness'].default_value=.59;shader.inputs['Sheen Weight'].default_value=.47
co=ns.new('ShaderNodeTexCoord');waves=[]
for direction,scale in [('X',31),('Y',23)]:
    w=ns.new('ShaderNodeTexWave');w.bands_direction=direction;w.inputs['Scale'].default_value=scale
    w.inputs['Distortion'].default_value=.7;lk.new(co.outputs['Object'],w.inputs['Vector']);waves.append(w)
mul=ns.new('ShaderNodeMath');mul.operation='MULTIPLY'
for i,w in enumerate(waves):lk.new(w.outputs['Fac'],mul.inputs[i])
b=ns.new('ShaderNodeBump');b.inputs['Strength'].default_value=.32;b.inputs['Distance'].default_value=.009
lk.new(mul.outputs[0],b.inputs['Height']);lk.new(b.outputs[0],shader.inputs['Normal'])
def trim(name,segments,r,mat):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=2
    for coords in segments:
        sp=cu.splines.new('POLY');sp.points.add(len(coords)-1)
        for p,coord in zip(sp.points,coords):p.co=(*coord,1)
    ob=bpy.data.objects.new(name,cu);scene.collection.objects.link(ob);cu.materials.append(mat)
thread=mat.copy();thread.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.11,.12,.116,1)
def seam(t,offset=0):
    y=t;x=3.6+y*.28+.41*math.sin(y*.71)+offset
    return x,y,form(x,y)+.014
for offset in [-.065,.065]:
    trim('Topstitch',[[seam(n*.084+v,offset) for v in (0,.022,.046)] for n in range(-72,72)],.008,thread)
trim('Raised seam',[[seam(n*.05) for n in range(-123,124)]],.027,mat)
def light(name,loc,power,color,size,sy):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='RECTANGLE';data.size=size;data.size_y=sy
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(-Vector(loc)).to_track_quat('-Z','Y').to_euler()
light('Raking strip',(6,2,2.1),550,(.8,.84,.89),4,.48);light('Soft bounce',(-2,3,5),200,(.8,.81,.77),6,4)
bpy.ops.object.camera_add(location=(0,0,10));cam=bpy.context.object;cam.rotation_euler=(0,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=14;scene.camera=cam
scene.render.resolution_x=1920;scene.render.resolution_y=1180;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='WEBP';scene.render.image_settings.quality=86
scene.render.filepath=str(here/'public'/'knit.webp');bpy.ops.render.render(write_still=True)
