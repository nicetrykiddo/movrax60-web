"""Rebuild the editable Cycles studio and the texture-free web rig with Blender."""
import json
import math
import random
from math import cos, pi, sin
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "art/textile"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rig = bpy.data.collections.new("Jacquard — web rig")
scene.collection.children.link(rig)
rng = random.Random(6319)


def textile(name, rgb, metal=0.04):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = .64
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Sheen Weight"].default_value = .34
    uv = nodes.new("ShaderNodeTexCoord")
    waves = []
    for axis, density in [("X", 100), ("Y", 86)]:
        node = nodes.new("ShaderNodeTexWave")
        node.bands_direction = axis
        node.inputs["Scale"].default_value = density
        links.new(uv.outputs["UV"], node.inputs["Vector"])
        waves.append(node)
    mix = nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY"
    for i, node in enumerate(waves):
        links.new(node.outputs["Fac"], mix.inputs[i])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .22
    bump.inputs["Distance"].default_value = .009
    links.new(mix.outputs[0], bump.inputs["Height"])
    links.new(bump.outputs[0], bsdf.inputs["Normal"])
    return mat


wine = textile("Oxblood silk", (.215, .037, .030))
copper = textile("Copper brocade", (.92, .51, .205), .16)
selvedge = textile("Twisted copper thread", (.57, .25, .081), .25)
plum = textile("Mulberry reverse", (.104, .027, .072))
indigo = textile("Midnight lining", (.031, .030, .081))
raw = textile("Raw silk", (.30, .106, .064))
hero_pos = (1.80, -.18, 1.65)


def drape(u, v, loc=hero_pos, w=4.35, h=3.49, yaw=.11, phase=.31):
    x = (u-.5)*w + .43*sin(v*2.2+phase)*(u-.24) + .18*(v-.5)
    d = (.41*sin(u*8.6+phase+v*.85) + .17*sin(u*16.1-v*5.3)
         + .22*(1-v)*sin(u*4.6+phase) + .037*sin(28*u+7*v)*(1-v)**2)
    z = (v-.5)*h + .17*sin(u*5.1+phase) + .34*u + .12*u*u
    return Vector((loc[0]+cos(yaw)*x-sin(yaw)*d,
                   loc[1]+sin(yaw)*x+cos(yaw)*d, loc[2]+z))


hoist_bottom = drape(0, 0)
hoist_top = drape(0, 1)


def surface(u, v):
    # Blend the shaped silk into a straight edge where it hangs from the hoist.
    t = max(0, min(1, u/.16))
    return drape(u, v) + (hoist_bottom.lerp(hoist_top, v) - drape(0, v))*(1-t*t*(3-2*t))


def cloth_coordinates(point):
    # X and height are monotonic in the cloth coordinates. Invert both
    # together to bind stitch tubes and the fringe to the underlying fabric.
    u = (point.x-hero_pos[0])/4.35+.5
    v = (point.z-hero_pos[2])/3.49+.5
    for _ in range(5):
        pos = surface(u, v)
        du = (surface(u+.001, v)-pos)*1000
        dv = (surface(u, v+.001)-pos)*1000
        dx, dz = point.x-pos.x, point.z-pos.z
        det = du.x*dv.z-du.z*dv.x
        u += (dx*dv.z-dz*dv.x)/det
        v += (du.x*dz-du.z*dx)/det
    return (max(0, min(1, u)), max(0, min(1, v)), 0)


def make_mesh(name, verts, faces, mats, uv=None, binding=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    rig.objects.link(obj)
    for mat in mats:
        mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    if uv is not None:
        layer = mesh.uv_layers.new()
        for loop in mesh.loops:
            layer.data[loop.index].uv = uv[loop.vertex_index]
    cloth = mesh.attributes.new("_CLOTH", "FLOAT_VECTOR", "POINT")
    coords = ((u, v, 0) for u, v in binding) if binding is not None else map(cloth_coordinates, verts)
    cloth.data.foreach_set("vector", [coord for point in coords for coord in point])
    return obj


def make_flag(name, nx, ny, position, material, crest=False):
    uv = [(x/nx, y/ny) for y in range(ny+1) for x in range(nx+1)]
    if crest:
        # Constrain triangle edges to the original vector tracing. The emblem is
        # woven from a second material in the surface, even at extreme close-up.
        edges = []
        for group in json.loads((ROOT/"art/pin/enamel.json").read_text()):
            for ring in group:
                start = len(uv)
                last = None
                for x, y in ring[:-1]:
                    if last and math.dist(last, (x,y)) < 3:
                        continue
                    last = (x,y)
                    uv.append(((x/1254+.21)/1.42, (y/1254+.155)/1.31))
                count = len(uv)-start
                if count >= 3:
                    edges.extend((start+i, start+(i+1)%count) for i in range(count))
        points, _, faces, *_ = delaunay_2d_cdt([Vector(p) for p in uv], edges, [], 0, 1e-7, False)
        uv = [tuple(p) for p in points]
    else:
        faces = [(i, i+1, i+nx+2, i+nx+1) for y in range(ny) for x in range(nx)
                 for i in [y*(nx+1)+x]]
    obj = make_mesh(name, [position(u,v) for u,v in uv], faces,
                    [material, copper] if crest else [material], uv, uv)
    if crest:
        source = bpy.data.images.load(str(ROOT/"art/pin/original.png"))
        size = source.size[0]
        pixels = np.empty(size*size*4, dtype=np.float32)
        source.pixels.foreach_get(pixels)
        mask = pixels.reshape(size,size,4)[:,:,0]
        for face in obj.data.polygons:
            u,v = np.mean([uv[i] for i in face.vertices], axis=0)
            ix,iy = int((u*1.42-.21)*size),int((v*1.31-.155)*size)
            if 0 <= ix < size and 0 <= iy < size and mask[iy,ix] > .25:
                face.material_index = 1
        bpy.data.images.remove(source)


make_flag("01 | House standard", 65, 55, surface, wine, True)
# Tubular chain stitches and unravelled yarn share the cloth binding.
verts, faces, thread_materials = [], [], []
def yarn(points, radius, material_index):
    start = len(verts)
    for i, point in enumerate(points):
        tangent = (points[min(i+1,len(points)-1)] - points[max(i-1,0)]).normalized()
        a = tangent.cross(Vector((0,1,0))).normalized()
        b = tangent.cross(a)
        for side in range(3):
            angle = side*2*pi/3
            verts.append(point+radius*(a*cos(angle)+b*sin(angle)))
        if i:
            j = start+i*3
            for side in range(3):
                faces.append((j-3+side,j-3+(side+1)%3,j+(side+1)%3,j+side))
                thread_materials.append(material_index)


def sewn(u,v):
    return surface(u,v)+Vector((0,-.014,0))


for v in (.009,.021,.965,.977):
    for i in range(97):
        u = (i+.15)/97
        yarn([sewn(u,v),sewn(u+.0034,v+.001),sewn(u+.0078,v)],.0047,0)
for u in (.012,.977):
    yarn([sewn(u,i/84) for i in range(85)],.009,0)
for i in range(285):
    u = (i+rng.random())/285
    start = surface(u,0)
    end = start+Vector((rng.uniform(-.036,.036),rng.uniform(-.045,.045),-rng.uniform(.048,.16)))
    yarn([start,start.lerp(end,.5)+Vector((.012,.007,0)),end],rng.uniform(.0026,.0046),int(i%4!=0))
threads = make_mesh("05 | Hem and fringe",verts,faces,[selvedge,raw])
for face, index in zip(threads.data.polygons,thread_materials):
    face.material_index = index

# The competition band and its reverse are sewn to this same surface.
def stitch_point(u, v, offset=.014):
    along = surface(u+.001,v)-surface(u-.001,v)
    up = surface(u,v+.001)-surface(u,v-.001)
    return surface(u,v) + along.cross(up).normalized()*offset


def transfer_yarn(name, materials):
    obj = make_mesh(name, verts, faces, materials)
    for face, index in zip(obj.data.polygons, thread_materials):
        face.material_index = index
    verts.clear()
    faces.clear()
    thread_materials.clear()
    return obj


verts.clear()
faces.clear()
thread_materials.clear()
for v in (.055,.137):
    for side in (-1,1):
        yarn([stitch_point(k/150,v,side*.012) for k in range(151)],.0047,0)
for v in (.087,.115,.143):
    for side in (-1,1):
        for k in range(27):
            u=.908+.09*k/27
            yarn([stitch_point(u,v+(u-.91)*.28,side*.018),
                  stitch_point(u+.003,v+(u-.91)*.28+.008,side*.02)],.0041,0)
transfer_yarn("Band piping and three repair stitches",[copper])

glyphs = [[(-.50,0),(0,.60),(.50,0),(0,-.60),(-.50,0)],
          [(0,-.60),(0,.60)], [(-.55,0),(.55,0)], [(-.46,-.46),(.46,.46)],
          [(cos(i*pi/16)*.47,sin(i*pi/16)*.47) for i in range(33)]]
for mark in range(5):
    center = .16+mark*.156
    def eye(x,y,side):
        return stitch_point(center+x*.026,.095+y*.033,.018*side)
    for side in (-1,1):
        for radius in (.90,1.07):
            yarn([eye(radius*cos(i*pi/36),radius*sin(i*pi/36),side) for i in range(73)],.006,0)
        for route in [glyphs[mark]] + ([[(0,-.55),(0,.55)]] if mark==2 else
                                        [[(-.46,.46),(.46,-.46)]] if mark==3 else []):
            yarn([eye(x,y,side) for x,y in route],.009,0)
    foil = textile("Event thread %d"%(mark+1),(.83,.48,.19),.20)
    transfer_yarn("Mark_%d"%(mark+1),[foil])

# Double-faced cloth carries a maker's label on its reverse.
nx,ny=28,12
uv=[(x/nx,y/ny) for y in range(ny+1) for x in range(nx+1)]
label_faces=[(i,i+nx+1,i+nx+2,i+1) for y in range(ny) for x in range(nx) for i in [y*(nx+1)+x]]
make_mesh("Roster_label",[stitch_point(.623+u*.266,.192+v*.184,-.027) for u,v in uv],
          label_faces,[plum],uv)
for v in (.20,.368):
    yarn([stitch_point(.63+i*.25/70,v,-.036) for i in range(71)],.0055,0)
for u in (.63,.88):
    yarn([stitch_point(u,.20+i*.168/35,-.036) for i in range(36)],.0055,0)
for i in range(8):
    u=.662+i*.026
    yarn([stitch_point(u+k*.001,.235+k*.008,-.039) for k in range(12)],.0062,0)
transfer_yarn("Roster_binding",[copper])

# Store a usable lighting rig and camera in the editable source.
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


for name, loc, rgb, power, size in [
    ("Softbox · honey",(-1.35,-3.3,5.3),(1,.64,.37),670,4),
    ("Rim · tangerine",(6,1.2,4.8),(1,.43,.23),520,3),
    ("Bounce · dusk",(4.8,-2.7,2.45),(.48,.42,.9),150,4.4)]:
    bpy.ops.object.light_add(type="AREA",location=loc)
    obj = bpy.context.object
    obj.name, obj.data.color, obj.data.energy, obj.data.size = name, rgb, power, size
    aim(obj,(2,0,1.5))
bpy.ops.object.camera_add(location=(.15,-8.4,2.72))
camera = bpy.context.object
camera.data.lens = 35
aim(camera,(.21,.2,1.56))
scene.camera = camera
sweep = [(-22,-.58),(3,-.58)] + [(3+4*sin(i*pi/40),3.42-4*cos(i*pi/40)) for i in range(1,21)] + [(7,16)]
backdrop = bpy.data.meshes.new("Seamless studio")
backdrop.from_pydata([(x,y,z) for y,z in sweep for x in (-24,24)],[],
                     [(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(sweep)-1)])
studio=bpy.data.objects.new("Cyclorama",backdrop)
scene.collection.objects.link(studio)
backdrop.materials.append(textile("Studio velvet",(.015,.009,.019)))
for face in backdrop.polygons:
    face.use_smooth=True
scene.world = bpy.data.worlds.new("Amethyst studio")
scene.world.color = (.055,.035,.06)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x,scene.render.resolution_y = 1600,1000
scene.render.resolution_percentage = 100
bpy.ops.object.select_all(action='DESELECT')
for obj in rig.objects:
    obj.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"standard.blend"),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/"public/models/standard.glb"),use_selection=True,
                          export_attributes=True,export_animations=False)
