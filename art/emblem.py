"""Studio render of the folded movrax60 ribbon. Run with blender -b -P art/emblem.py."""
import bpy, math
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parent.parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='OPTIX'
    prefs.refresh_devices()
    for device in prefs.devices: device.use=device.type=='OPTIX'
    if any(d.use for d in prefs.devices): scene.cycles.device='GPU'
except RuntimeError: pass
scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Lilac studio')
scene.world.color=(.21,.17,.26)
metal=bpy.data.materials.new('Brushed palladium');metal.use_nodes=True
bs=metal.node_tree.nodes.get('Principled BSDF')
bs.inputs['Metallic'].default_value=.95
bs.inputs['Roughness'].default_value=.19
grain=metal.node_tree.nodes.new('ShaderNodeTexNoise')
grain.inputs['Scale'].default_value=235
grain.inputs['Detail'].default_value=2
roughness=metal.node_tree.nodes.new('ShaderNodeMapRange')
roughness.inputs['To Min'].default_value=.15
roughness.inputs['To Max'].default_value=.26
metal.node_tree.links.new(grain.outputs['Fac'],roughness.inputs['Value'])
metal.node_tree.links.new(roughness.outputs[0],bs.inputs['Roughness'])
bs.inputs['Base Color'].default_value=(.70,.63,.83,1)
# A continuous twisted triangular loop with a bevelled rectangular section.
verts=[];faces=[];steps=300
def path(t):
    return Vector(((2.2+.48*math.cos(3*t))*math.cos(t),.62*math.sin(3*t+.7),(2.2+.48*math.cos(3*t))*math.sin(t)))
for i in range(steps):
    t=i*2*math.pi/steps
    tangent=(path(t+.001)-path(t-.001)).normalized()
    across=tangent.cross(Vector((0,1,0))).normalized()
    normal=tangent.cross(across)
    angle=1.7*t+1.05*math.sin(t*2)-.7*t
    width=across*math.cos(angle)+normal*math.sin(angle)
    depth=tangent.cross(width)
    for side,edge in [(-1,-1),(1,-1),(1,1),(-1,1)]:
        verts.append(path(t)+side*width*.57+edge*depth*.11)
    for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,((i+1)%steps)*4+(j+1)%4,((i+1)%steps)*4+j))
mesh=bpy.data.meshes.new('Folded loop');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Fold',mesh);scene.collection.objects.link(obj);obj.data.materials.append(metal)
for p in mesh.polygons:p.use_smooth=True
mod=obj.modifiers.new('Rounded edges','BEVEL');mod.width=.07;mod.segments=5
obj.modifiers.new('Studio normals','WEIGHTED_NORMAL')
def aim(o):o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
for pos,energy,size,color in [((-3,-4,5),1400,5,(1,.98,1)),((4,1,2),2100,3,(.58,.42,1)),((2,-3,-4),1350,3,(.67,.82,1)),((-4,1,0),1200,1,(1,1,1))]:
    bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=energy;l.data.shape='RECTANGLE';l.data.size=size;l.data.size_y=size*.37;l.data.color=color;aim(l)
bpy.ops.object.camera_add(location=(2,-11,3));cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=7.1;scene.camera=cam
scene.render.resolution_x=960;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='WEBP';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.quality=93
scene.render.filepath=str(root/'public'/'fold.webp')
bpy.ops.render.render(write_still=True)

# The camera moves around the sculpture while the physical studio lights stay fixed.
frames=root/'public'/'turn'
frames.mkdir(exist_ok=True)
scene.render.resolution_x=720
scene.render.resolution_y=720
scene.render.image_settings.quality=86
for frame in range(64):
    phase=frame/63
    theta=math.atan2(2,11)+phase*math.radians(112)
    cam.location=(math.sin(theta)*11.18,-math.cos(theta)*11.18,3+2.4*math.sin(phase*math.pi))
    aim(cam)
    scene.render.filepath=str(frames/f'{frame:02}.webp')
    bpy.ops.render.render(write_still=True)
