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


def surface(u, v, loc=hero_pos, w=4.35, h=3.49, yaw=.11, phase=.31):
    x = (u-.5)*w + .43*sin(v*2.2+phase)*(u-.24) + .18*(v-.5)
    d = (.41*sin(u*8.6+phase+v*.85) + .17*sin(u*16.1-v*5.3)
         + .22*(1-v)*sin(u*4.6+phase) + .037*sin(28*u+7*v)*(1-v)**2)
    z = (v-.5)*h + .17*sin(u*5.1+phase) + .34*u + .12*u*u
    return Vector((loc[0]+cos(yaw)*x-sin(yaw)*d,
                   loc[1]+sin(yaw)*x+cos(yaw)*d, loc[2]+z))


def displacement(p, amount):
    x, y, z = p
    free = max(0, min(1, (x+.5)/4.65))
    hem = max(0, min(1, (3.8-z)/3.9))
    strength = free**1.35 * (.22+1.25*hem)
    if amount == "Lift":
        return Vector((-.59*strength, -1.02*strength, 1.16*strength))
    return Vector((.34*strength, strength*.35*sin(2.9*x+.74*z), .10*strength))


def make_mesh(name, verts, faces, mats, uv=None, morph=False):
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
    if morph:
        obj.shape_key_add(name="Rest")
        for label in ("Lift", "Draw"):
            key = obj.shape_key_add(name=label)
            for vert, point in zip(mesh.vertices, key.data):
                point.co = vert.co + displacement(vert.co, label)
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
                    [material, copper] if crest else [material], uv, crest)
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
for name, loc, w, h, yaw, phase, mat in [
    ("02 | Pleated facing", (.79,1.38,1.59),2.9,3.6,-.67,1.77,plum),
    ("03 | Indigo fall", (4.56,1.80,1.78),3.2,3.9,-.76,3.50,indigo),
    ("04 | Valance", (1.03,3.18,3.46),3.9,1.36,.16,1.12,plum),
]:
    make_flag(name, 44, 32, lambda u,v: surface(u,v,loc,w,h,yaw,phase), mat)

# Tubular chain stitches and unravelled yarn share one mesh and two pose keys.
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
threads = make_mesh("05 | Hem and fringe",verts,faces,[selvedge,raw],morph=True)
for face, index in zip(threads.data.polygons,thread_materials):
    face.material_index = index

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
bpy.ops.mesh.primitive_plane_add(size=100, location=(0,0,-.58))
bpy.context.object.data.materials.append(textile("Cyclorama",(.015,.009,.019)))
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
                          export_morph_normal=False,export_animations=False)
