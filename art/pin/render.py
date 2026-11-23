"""Blender Cycles product photography for the movrax60 mascot pin."""
import bpy
import json
import math
import os
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = Path(os.environ.get("PIN_OUT", ROOT / "public/pin"))
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(os.getenv('PIN_SAMPLES', '18'))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.use_persistent_data = True
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'OPTIX'
    prefs.refresh_devices()
    for device in prefs.devices:
        device.use = device.type == 'OPTIX'
    if any(device.use for device in prefs.devices):
        scene.cycles.device = 'GPU'
        scene.cycles.denoising_use_gpu = True
        scene.cycles.denoiser = 'OPTIX'
except (RuntimeError, TypeError):
    pass
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.quality = 87
scene.render.resolution_x = scene.render.resolution_y = 960
scene.render.resolution_percentage = int(os.getenv('PIN_SCALE', '100'))
world = bpy.data.worlds.new('Studio reflections')
scene.world = world
world.use_nodes = True
env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(str(ROOT/'art/library/lighting/small_workshop/hdri.hdr'))
world.node_tree.links.new(env.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .36

def material(name, color, metallic, roughness, coat=0, scratched=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    ns, lk = m.node_tree.nodes, m.node_tree.links
    p = ns['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = .13
    if scratched:
        tex = ns.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(next((ROOT/'art/library/surface/Scratches005').glob('*Opacity*'))),check_existing=True)
        tex.image.colorspace_settings.name = 'Non-Color'
        tex.projection = 'BOX'
        tex.projection_blend = .15
        co = ns.new('ShaderNodeTexCoord')
        lk.new(co.outputs['Generated'], tex.inputs['Vector'])
        rng = ns.new('ShaderNodeMapRange')
        rng.inputs['To Min'].default_value = roughness
        rng.inputs['To Max'].default_value = roughness + .22
        lk.new(tex.outputs['Color'], rng.inputs['Value'])
        lk.new(rng.outputs['Result'], p.inputs['Roughness'])
    return m

nickel = material('Polished black nickel', (.008,.009,.011), .52, .32, .04, True)
edge = material('Bright die-cut silver', (.63,.61,.55), .95, .2, .1, True)
ivory = material('Fired ivory enamel', (.94,.76,.49), .02, .25, .45)
bronze = material('Oxidized spring brass',(.53,.29,.082),.86,.21,.1,True)
stamp = material('Dark recessed stamp',(.022,.021,.019),.54,.4)
milled = material('Sandblasted backplate',(.23,.225,.216),.88,.38,0,True)

rig = bpy.data.objects.new('Enamel pin', None)
scene.collection.objects.link(rig)

def outline(name, polygons, z, depth, bevel, mat, scale=1):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = depth
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    for polygon in polygons:
        for ring in polygon:
            line = cu.splines.new('POLY')
            line.points.add(len(ring)-2)
            for point,(x,y) in zip(line.points,ring[:-1]):
                point.co = ((x-625)*.0034*scale,(y-600)*.0034*scale,0,1)
            line.use_cyclic_u = True
    obj = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(obj)
    obj.location.z=z
    obj.parent=rig
    cu.materials.append(mat)
    return obj

silhouette=json.loads((HERE/'outline.json').read_text())
outline('Struck nickel blank',silhouette,-.06,.062,.023,edge)
outline('Dark raised outline',silhouette,.018,.010,.008,nickel)
outline('Enamel pools',json.loads((HERE/'enamel.json').read_text()),.038,.008,.010,ivory)
outline('Brushed reverse',silhouette,-.149,.004,.003,milled,.989)

def cylinder(name,x,y,z,r,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=80,radius=r,depth=depth,location=(x,y,z))
    obj=bpy.context.object;obj.name=name;obj.parent=rig;obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Rounded stamping','BEVEL');bevel.width=.008;bevel.segments=3
    obj.modifiers.new('Facet normals','WEIGHTED_NORMAL')
    return obj

def wire(name, coords, r, mat, cyclic=False):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12
    cu.bevel_depth=r;cu.bevel_resolution=4
    path=cu.splines.new('BEZIER');path.bezier_points.add(len(coords)-1)
    for p,co in zip(path.bezier_points,coords):
        p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    path.use_cyclic_u=cyclic
    ob=bpy.data.objects.new(name,cu);scene.collection.objects.link(ob);ob.parent=rig;cu.materials.append(mat)
    return ob

# A real tie-tack clutch with curled wings, a stem and stamped serrations.
cx,cy=-.14,.39
for name,z,r,d,mat in [('Solder pad',-.15,.25,.032,edge),('Pin stem',-.24,.036,.20,edge),('Clutch disc',-.35,.275,.053,bronze),('Crown',-.398,.141,.065,bronze)]:
    cylinder(name,cx,cy,z,r,d,mat)
for r in (.21,.253):
    wire('Coined rings',[(cx+r*math.cos(i*math.tau/32),cy+r*math.sin(i*math.tau/32),-.384) for i in range(32)],.007,bronze,True)
for sign in (-1,1):
    for dy in (-.025,0,.025):
        wire('Pressed butterfly wing',[(cx+sign*.027,cy+dy,-.39),(cx+sign*.067,cy+dy,-.60),(cx+sign*.19,cy+dy,-.53),(cx+sign*.135,cy+dy,-.42)],.024,bronze)
for i in range(32):
    a=i*math.tau/32
    wire('Clutch fluting',[(cx+.236*math.cos(a),cy+.236*math.sin(a),-.382),(cx+.265*math.cos(a),cy+.265*math.sin(a),-.374)],.005,bronze)

def stamp_text(body,y,size,mat):
    cu=bpy.data.curves.new(body,'FONT');cu.body=body;cu.align_x='CENTER';cu.align_y='CENTER'
    cu.size=size;cu.extrude=.002;cu.bevel_depth=.0008
    obj=bpy.data.objects.new(body,cu);scene.collection.objects.link(obj);cu.materials.append(mat)
    obj.parent=rig;obj.location=(.04,y,-.159);obj.rotation_euler.y=math.pi
stamp_text('movrax60',-.22,.27,stamp)
stamp_text('INTERNATIONAL CTF TEAM',-.44,.071,stamp)
stamp_text('HARD ENAMEL   /   60',-.69,.058,stamp)

def area(name,loc,power,color,width,height):
    lamp=bpy.data.lights.new(name,'AREA');lamp.energy=power;lamp.color=color
    lamp.shape='RECTANGLE';lamp.size=width;lamp.size_y=height
    obj=bpy.data.objects.new(name,lamp);scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(-Vector(loc)).to_track_quat('-Z','Y').to_euler()
area('Warm silk',(-3,3,4.1),330,(1,.84,.67),4,1.8)
area('Edge strip',(3.8,.5,2),370,(.71,.83,1),.65,4.0)
area('Rear softbox',(-1.2,1.3,-3),350,(1,.86,.68),3,2.5)
area('Low bounce',(0,-3.5,.9),100,(1,.51,.25),2.4,.6)
bpy.ops.object.camera_add(location=(0,0,8.6))
cam=bpy.context.object;scene.camera=cam;cam.rotation_euler=(0,0,0);cam.data.lens=63
scene.view_settings.view_transform='AgX'
frames=[int(x) for x in os.getenv('PIN_FRAMES',','.join(str(i) for i in range(120))).split(',')]
for i in frames:
    angle=math.tau*i/120
    rig.rotation_mode='XYZ'
    rig.rotation_euler=(math.radians(-10+5*math.sin(angle)),angle+math.radians(-12),math.radians(-9+3*math.sin(angle)))
    scene.render.filepath=str(OUT/f'{i:03}.webp')
    bpy.ops.render.render(write_still=True)
