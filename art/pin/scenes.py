"""Render the scroll shots in Cycles. Each set has a wide and a portrait camera."""
import bpy
import json
import math
import os
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'scenes'
COUNT = 30
SHOTS = ['roster', 'salt', 'nullcon', 'ritsec', 'script', 'chronos', 'contact']
HANDLES = [member['handle'] for member in json.loads((ROOT/'records.json').read_text())['members']]
PLAYERS = ['player-'+handle.lower() for handle in HANDLES]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 14
scene.cycles.use_denoising = True
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
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.quality = 83
scene.view_settings.view_transform = 'AgX'
world = bpy.data.worlds.new('Studio black')
world.use_nodes = True
scene.world = world
ns, links = world.node_tree.nodes, world.node_tree.links
env = ns.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(str(ROOT/'art/library/lighting/small_workshop/hdri.hdr'))
links.new(env.outputs['Color'], ns['Background'].inputs['Color'])
ns['Background'].inputs['Strength'].default_value = .18

def material(name, color, metal, roughness, emission=0, grain=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    shader = ns['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = emission
    if grain:
        noise = ns.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 173
        bump = ns.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = grain
        bump.inputs['Distance'].default_value = .025
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs[0], shader.inputs['Normal'])
    return mat

black = material('Bead-blasted black aluminum', (.031,.043,.044), .71, .31, grain=.27)
table = material('Charcoal work surface', (.034,.040,.042), .18, .55, grain=.31)
metal = material('Machined nickel', (.31,.34,.32), .93, .22, grain=.09)
dark_metal = material('Black nickel', (.058,.072,.071), .90, .23)
ivory = material('Ivory stamped type', (.87,.89,.77), .18, .34)
mint = material('Acid green acrylic', (.59,.92,.075), .18, .25, .19)
glow = material('Acid green LED', (.61,.98,.14), .12, .24, 2.1)
gray = material('Frosted clear polymer', (.36,.45,.42), .62, .19)

def finish(o, name, mat, bevel=0, parent=None):
    o.name = name
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    if bevel:
        modifier = o.modifiers.new('Machined edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return o

def box(name, pos, dimensions, mat, bevel=.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o,name,mat,bevel,parent)

def cylinder(name, pos, radius, depth, mat, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=radius,depth=depth,location=pos)
    o = bpy.context.object
    for poly in o.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return finish(o,name,mat,.014,parent)

def ring(name, pos, radius, tube, mat, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=104,minor_segments=10,major_radius=radius,minor_radius=tube,location=pos)
    o = bpy.context.object
    for poly in o.data.polygons:
        poly.use_smooth = True
    return finish(o,name,mat,parent=parent)

def wire(name, coords, radius, mat, parent=None):
    cu = bpy.data.curves.new(name,'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 14
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    curve = cu.splines.new('BEZIER')
    curve.bezier_points.add(len(coords)-1)
    for p, co in zip(curve.bezier_points,coords):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    o=bpy.data.objects.new(name,cu)
    scene.collection.objects.link(o)
    return finish(o,name,mat,parent=parent)

def typeface(body, pos, size, mat, parent=None):
    cu = bpy.data.curves.new(body,'FONT')
    cu.body = body
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = size
    cu.extrude = .0025
    o = bpy.data.objects.new(body,cu)
    scene.collection.objects.link(o)
    o.location = pos
    return finish(o,body,mat,parent=parent)

def rig(name):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    return o

def desk():
    box('Studio surface',(0,0,-.87),(40,40,.48),table,.06)
    for offset in (-5.7,-5.66,4.82,4.86):
        box('Recessed edge',(offset,0,-.617),(.018,40,.009),dark_metal,.003)

def badge():
    o = rig('Player credentials')
    for i,name in enumerate(HANDLES):
        x = (i%2-.5)*2.03
        y = (i//2-1.5)*.95
        c = box('Per-player nickel blank',(x,y,-.21),(1.91,.79,.19),black,.085,o)
        box('Edge insert',(x-.79,y,-.104),(.077,.45,.013),mint if i in (0,4,7) else dark_metal,.006,o)
        box('Die-cut edge',(x,y,-.295),(1.89,.77,.04),metal,.018,o)
        typeface(name,(x+.06,y,-.101),.16,ivory,o)
        ring('Circular fastener',(x+.78,y,-.105),.044,.012,metal,o)
    return o

def player(handle, order):
    o = rig('Player nameplate')
    box('Anodized blank',(0,0,-.17),(3.51,1.64,.28),edge_material(order),.13,o)
    box('Nameplate field',(0,0,-.021),(3.42,1.54,.052),black,.092,o)
    box('Enamel stripe',(-1.47,0,.011),(.091,1.04,.014),mint,.012,o)
    typeface(handle,(.08,.05,.021),.36,ivory,o)
    typeface('movrax60',(.09,-.36,.021),.108,ivory,o)
    for x in (-1.51,1.51):
        for y in (-.56,.56):
            cylinder('Countersunk rivet',(x,y,.021),.055,.038,metal,o)
    for i in range(7):
        box('Machined trace',(-.9+i*.27,-.60,.009),(.18,.013,.01),dark_metal,.002,o)
    return o

def edge_material(order):
    return metal if order%2 == 0 else gray

def result(i):
    o = rig('Competition set')
    if i == 0:
        cylinder('Counterweighted turntable',(0,0,-.35),1.95,.37,black,o)
        cylinder('Glass analyser',(0,0,-.05),1.48,.20,dark_metal,o)
        for r in (1.00,1.15,1.27,1.71,1.86,1.91): ring('Diamond turned groove',(0,0,.07 if r<1.3 else -.147),r,.016,metal,o)
        ring('Illuminated inner ring',(0,0,.081),1.34,.055,glow,o)
        cylinder('Illuminated core',(0,0,.11),.75,.13,black,o)
        cylinder('Acid green glass insert',(0,0,.175),.63,.033,mint,o)
        for k in range(32):
            a=k*math.tau/32
            bar=box('Engraved index',(1.60*math.cos(a),1.60*math.sin(a),-.158),(.10,.012,.025),ivory,.003,o)
            bar.rotation_euler.z=a
    elif i == 1:
        for a in range(5):
            for b in range(5):
                h=.13+.12*(math.cos(a*1.24+b*1.65)+1)
                x,y=(a-2)*.64,(b-2)*.64
                box('Ceramic key',(x,y,-.30+h/2),(.56,.56,h),black if (a+b)%4 else gray,.047,o)
                box('Engraved inlay',(x,y,-.294+h),(.28,.025,.013),mint if (a,b) in [(1,2),(2,2),(3,2),(3,3),(3,1)] else dark_metal,.008,o)
        box('Printed substrate',(0,0,-.36),(3.46,3.46,.18),dark_metal,.12,o)
    elif i == 2:
        for k in range(7):
            yy=(k-3)*.48
            box('Heat-sink rail',(0,yy,-.26),(3.58,.31,.43),black if k%2==0 else gray,.05,o)
            box('Satin rail lip',(0,yy+.17,-.061),(3.43,.018,.022),metal,.012,o)
        for k in range(5):
            wire('Flexible routed lead',[(-2,-1.57+k*.12,-.05),(-1.15,-1.26+k*.17,.18),(.04,-.39+k*.18,.38),(1.17,.43+k*.21,.25),(1.9,1.10+k*.14,-.075)],.032,mint if k==2 else metal,o)
    elif i == 3:
        for k in range(6):
            a = k * math.tau/6
            ob=box('Polished radial arm',(.96*math.cos(a),.96*math.sin(a),-.11),(2.02,.42,.32),dark_metal,.088,o)
            ob.rotation_euler.z=a
            ob=box('Acid stripe',(1.48*math.cos(a),1.48*math.sin(a),.06),(.50,.018,.015),mint,.005,o)
            ob.rotation_euler.z=a
        cylinder('Satin center cap',(0,0,.11),.81,.22,black,o)
        ring('Grip undercut',(0,0,.224),.76,.017,metal,o)
        for k in range(3):
            ring('Concentric machined mark',(0,0,.225),.59+k*.042,.005,metal,o)
    else:
        for k in range(5):
            size = 3.56-k*.52
            edge=box('Stacked anodized frame',(0,0,-.32+k*.17),(size,size,.135),black if k%2==0 else dark_metal,.12,o)
            edge.rotation_euler.z=k*.106
            for direction in (-1,1):
                stripe=box('Exposed brushed edge',(0,direction*(size/2-.17),-.244+k*.17),(size-.34,.018,.014),mint if k==4 else metal,.003,o)
                stripe.rotation_euler.z=k*.106
        cylinder('Countersunk cap',(0,0,.437),.46,.14,gray,o)
        ring('Socket profile',(0,0,.511),.28,.018,dark_metal,o)
    return o

def contact():
    o=rig('Connection point')
    for i in range(3):
        x=(i-1)*1.04
        box('Nickel barrel mount',(x,.2,-.26),(.83,2.55,.52),black,.18,o)
        cylinder('Recessed connector',(x,.52,.011),.33,.11,metal,o)
        cylinder('Insulating sleeve',(x,.52,.074),.237,.042,dark_metal,o)
        ring('Connector indicator',(x,.52,.103),.152,.023,glow if i==1 else metal,o)
        wire('Braided audio lead',[(x,-.31,.08),(x+.05,-.79,.15),(x+.21,-1.17,.16),(x+.51,-2.16,-.23),(x+.75,-3.85,-.49)],.072,black,o)
    return o

def light(name, pos, power, color, width, height):
    data = bpy.data.lights.new(name,'AREA')
    data.energy = power
    data.color = color
    data.shape = 'RECTANGLE'
    data.size, data.size_y = width, height
    ob = bpy.data.objects.new(name,data)
    scene.collection.objects.link(ob)
    ob.location = pos
    ob.rotation_euler = (-Vector(pos)).to_track_quat('-Z','Y').to_euler()
    return ob

key = light('Long softbox above the object',(-3,3,5.6),555,(.83,.91,1),5.7,1.6)
kick = light('Acid acrylic bounce',(4,-2,2.8),200,(.63,.92,.23),2.5,.48)
light('Overhead cloth',(-1,-6,5),230,(.67,.76,.86),6,2.6)
bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
permanent = set(scene.objects)
shot_filter = os.getenv('SCENE_SHOTS',','.join(SHOTS)).split(',')
frames = [int(x) for x in os.getenv('SCENE_FRAMES', ','.join(map(str,[0,16,29]+[i for i in range(COUNT) if i not in (0,16,29)]))).split(',')]
views = os.getenv('SCENE_VIEWS','wide,tall').split(',')

for shot in shot_filter:
    for ob in list(scene.objects):
        if ob not in permanent:
            bpy.data.objects.remove(ob,do_unlink=True)
    is_player = shot in PLAYERS
    order = PLAYERS.index(shot) if is_player else SHOTS.index(shot)
    desktop_right = (order%2==0) if is_player else shot not in ('roster','ritsec','chronos')
    desk()
    if is_player:
        obj = player(HANDLES[order],order)
    elif shot=='roster':
        obj = badge()
    elif shot=='contact':
        obj = contact()
    else:
        obj = result(order-1)
    kick.data.color = {
        'roster': (.67,.91,.26), 'salt': (.75,.98,.19), 'nullcon': (.50,.71,1),
        'ritsec': (.69,.94,.42), 'script': (.87,.68,.37), 'chronos': (.38,.83,1),
        'contact': (.77,.97,.29),
    }.get(shot, ((.63,.91,.27) if order%2==0 else (.50,.75,1)))
    for view in views:
        portrait = view=='tall'
        scene.render.resolution_x = 768 if portrait else 1320
        scene.render.resolution_y = 1024 if portrait else 880
        target=OUT/shot/view
        target.mkdir(parents=True,exist_ok=True)
        for f in frames:
            t = f/(9 if is_player else COUNT-1)
            angle = ((order%3)*.28-.43 if is_player else order*.37-.65)
            travel = {'contact': -.65, 'ritsec': -.81, 'chronos': -.81}
            angle += travel.get(shot, .61 if is_player else .74) * t
            obj.rotation_euler.z = angle
            obj.location.z = .12*math.sin(t*math.pi)
            shift = math.sin(t*math.pi/2)
            if shot == 'ritsec':
                cam.location = (1.25-.61*shift,-3.54+t*1.94,7.3-.47*t)
            elif shot == 'chronos':
                cam.location = (1.73-.40*shift,-2.89+t*.47,8.15-1.21*t)
            else:
                cam.location = (.95-.45*shift,-3.3+t*.84,7.8-.87*t)
            cam.data.lens = (44 if portrait else 41) + 3*t
            focus = Vector((-1.90 if desktop_right else 1.84,-.43,0))
            if portrait:
                focus = Vector((-.16,-1.18,0))
                cam.data.lens -= 5
            cam.rotation_euler = (focus-cam.location).to_track_quat('-Z','Y').to_euler()
            key.location.x=-3+2*t
            key.rotation_euler=(-key.location).to_track_quat('-Z','Y').to_euler()
            kick.data.energy=140+100*t
            scene.render.filepath=str(target/f'{f:03}.webp')
            bpy.ops.render.render(write_still=True)
