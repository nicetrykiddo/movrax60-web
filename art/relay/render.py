"""Camera projection, glass and the ember sweep for The Relay.

Run from the repository root with Blender. Use RELAY_SHOTS, RELAY_VIEWS and
RELAY_FRAMES for lighting proofs. Renders are staged outside the public tree.
"""
import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parents[2]
PLATES = ROOT / 'art/relay/plates'
OUT = Path(os.environ.get('RELAY_OUT', '/tmp/relay-frames'))
FRAME_COUNTS = {'entrance': 76, 'interior': 115, 'passage': 106, 'contact': 73}
INK = (.006, .004, .003, 1)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(os.environ.get('RELAY_SAMPLES', '8'))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
scene.cycles.transparent_max_bounces = 8
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
scene.world = bpy.data.worlds.new('Unlit location')
scene.world.color = (.032, .024, .019)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.quality = 94

cam_data = bpy.data.cameras.new('Projection camera')
cam_data.lens = 37
cam_data.sensor_width = 36
cam_data.sensor_fit = 'HORIZONTAL'
camera = bpy.data.objects.new('Projection camera', cam_data)
scene.collection.objects.link(camera)
scene.camera = camera

def material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links

def emission(name, tint, strength=1):
    m, nodes, links = material(name)
    node = nodes.new('ShaderNodeEmission')
    node.inputs['Color'].default_value = tint
    node.inputs['Strength'].default_value = strength
    links.new(node.outputs[0], nodes['Material Output'].inputs[0])
    return m, node

def solid(name, tint, roughness):
    m, nodes, _ = material(name)
    node = nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = tint
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = .45
    return m

def box(name, location, size, surface, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        edge = ob.modifiers.new('Rounded steel profile', 'BEVEL')
        edge.width = bevel
        edge.segments = 3
    ob.data.materials.append(surface)
    return ob

def ease(x):
    x = min(1, max(0, x))
    return x*x*(3-2*x)

def bump(x, y, tx, ty, sx, sy):
    return math.exp(-((x-tx)/sx)**2 - ((y-ty)/sy)**2)

def depth(name, x, y):
    floor = ease((.48-y)/.50)
    near = ease((x-.83)/.17)
    if name == 'entrance':
        return max(3.6, 16.5 - 10.6*floor - 9.8*near - 3.4*bump(x,y,.72,.52,.3,.56))
    if name == 'interior':
        return max(3.6, 14.8 - 8.5*floor - 7.8*bump(x,y,.98,.55,.26,.73))
    if name == 'passage':
        return max(3.8, 17.0 - 10.8*floor - 10.3*bump(x,y,.96,.55,.30,.72))
    return max(4.0, 23.5 - 17*bump(x,y,.99,.5,.17,.77) - 11.8*floor)

def light_stamp(nodes, links, uv, place, separation, tone):
    distance = nodes.new('ShaderNodeVectorMath')
    distance.operation = 'DISTANCE'
    distance.inputs[1].default_value = (*place, 0)
    links.new(uv, distance.inputs[0])
    spread = nodes.new('ShaderNodeMapRange')
    spread.interpolation_type = 'SMOOTHSTEP'
    spread.inputs['From Max'].default_value = separation
    spread.inputs['To Min'].default_value = 1
    spread.inputs['To Max'].default_value = 0
    links.new(distance.outputs['Value'], spread.inputs['Value'])
    add = nodes.new('ShaderNodeMixRGB')
    add.blend_type = 'ADD'
    add.inputs[2].default_value = tone
    links.new(spread.outputs[0], add.inputs[0])
    return distance.inputs[1], add

def projection(name, view, aspect):
    path = PLATES / f'{name}-{view}.webp'
    if not path.exists():
        path = PLATES / f'{name}-wide.webp'
    source = bpy.data.images.load(str(path), check_existing=True)
    source_aspect = source.size[0] / source.size[1]
    # Build a relief in camera rays, so its first view keeps the photographic geometry.
    horizontal = max(1, source_aspect / aspect)
    vertical = max(1, aspect / source_aspect)
    overscan = 1.12
    center = .53 if view == 'tall' and source_aspect > 1.1 else .50
    h = cam_data.sensor_width / (2 * cam_data.lens)
    columns, rows = 61, 41
    coords = []
    uv_coords = []
    faces = []
    for j in range(rows):
        y = j / (rows - 1)
        for i in range(columns):
            x = i / (columns - 1)
            z = depth(name, x, y)
            coords.append(((x-center)*2*h*horizontal*overscan*z, (y-.5)*2*h/aspect*vertical*overscan*z, -z))
            uv_coords.append((x,y))
            if i and j:
                last = len(coords) - 1
                faces.append((last-columns-1,last-columns,last,last-1))
    mesh = bpy.data.meshes.new('Projected ' + name)
    mesh.from_pydata(coords, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new()
    for loop in mesh.loops:
        uv.data[loop.index].uv = uv_coords[loop.vertex_index]
    m, glow = emission('Photographic projection ' + name, (1,1,1,1))
    image = m.node_tree.nodes.new('ShaderNodeTexImage')
    image.image = source
    image.interpolation = 'Cubic'
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    coords = nodes.new('ShaderNodeTexCoord').outputs['UV']
    trace, flare = light_stamp(nodes, links, coords, (.0,.0), .106, (.28,.084,.016,1))
    point, core = light_stamp(nodes, links, coords, (.0,.0), .026, (.43,.21,.064,1))
    mirror, reflected = light_stamp(nodes, links, coords, (.0,.0), .137, (.092,.025,.006,1))
    links.new(image.outputs['Color'], flare.inputs[1])
    links.new(flare.outputs[0], core.inputs[1])
    links.new(core.outputs[0], reflected.inputs[1])
    links.new(reflected.outputs[0], glow.inputs['Color'])
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.append(m)
    scene.collection.objects.link(ob)
    return ob, trace, point, mirror

def glass_surface():
    m, nodes, links = material('Wet smoked glass')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    transparent.inputs['Color'].default_value = (.982,.959,.928,1)
    sheen = nodes.new('ShaderNodeBsdfGlossy')
    sheen.inputs['Color'].default_value = (.30,.17,.084,1)
    sheen.inputs['Roughness'].default_value = .18
    drops = nodes.new('ShaderNodeTexVoronoi')
    drops.distance = 'EUCLIDEAN'
    drops.inputs['Scale'].default_value = 113
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .085
    ramp.color_ramp.elements[1].position = .29
    normal = nodes.new('ShaderNodeBump')
    normal.inputs['Distance'].default_value = .015
    normal.inputs['Strength'].default_value = .28
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = .075
    links.new(drops.outputs['Distance'], ramp.inputs[0])
    links.new(ramp.outputs[0], normal.inputs['Height'])
    links.new(normal.outputs[0], sheen.inputs['Normal'])
    links.new(transparent.outputs[0],mix.inputs[1])
    links.new(sheen.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],nodes['Material Output'].inputs[0])
    return m

def etched_mark():
    curve = bpy.data.curves.new('Frosted mascot etching', 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = .0009
    curve.bevel_depth = .0006
    polygons = json.loads((ROOT/'art/pin/enamel.json').read_text())
    for border in polygons:
        for points in border:
            spline = curve.splines.new('POLY')
            spline.points.add(len(points)-2)
            spline.use_cyclic_u = True
            for point,(x,y) in zip(spline.points,points[:-1]):
                point.co = ((x-625)*.00041,(y-600)*.00041,0,1)
    obj = bpy.data.objects.new('Frosted movrax60 etching',curve)
    scene.collection.objects.link(obj)
    film, nodes, links = material('Subsurface sandblast')
    tex = nodes.new('ShaderNodeTexCoord')
    separate = nodes.new('ShaderNodeSeparateXYZ')
    subtract = nodes.new('ShaderNodeMath')
    subtract.operation = 'SUBTRACT'
    subtract.inputs[1].default_value = .35
    power = nodes.new('ShaderNodeMath')
    power.operation = 'ABSOLUTE'
    strength = nodes.new('ShaderNodeMapRange')
    strength.inputs['From Min'].default_value = .0
    strength.inputs['From Max'].default_value = .63
    strength.inputs['To Min'].default_value = .71
    strength.inputs['To Max'].default_value = .24
    lite = nodes.new('ShaderNodeEmission')
    lite.inputs['Color'].default_value = (.96, .69, .37, 1)
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(tex.outputs['Generated'], separate.inputs['Vector'])
    links.new(separate.outputs['X'], subtract.inputs[0])
    links.new(subtract.outputs[0], power.inputs[0])
    links.new(power.outputs[0], strength.inputs[0])
    links.new(strength.outputs[0], lite.inputs['Strength'])
    mix.inputs[0].default_value = .84
    links.new(clear.outputs[0],mix.inputs[1])
    links.new(lite.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],nodes['Material Output'].inputs[0])
    obj.data.materials.append(film)
    return obj, subtract, mix

amber = bpy.data.lights.new('Sweeping amber practical', 'AREA')
amber.color = (1,.49,.19)
amber.energy = 39
amber.shape = 'RECTANGLE'
amber.size = 1.0
amber.size_y = .31
lamp = bpy.data.objects.new('Sweeping amber practical',amber)
scene.collection.objects.link(lamp)
lamp.rotation_euler = Euler((.28,-.24,.19))
door = box('Camera-side glass pane', (0,0,-2.45),(.79,2.05,.013),glass_surface(),.009)
door.rotation_euler.y = -.22
edge = box('Anodized glazing profile',(0,0,-2.47),(.032,2.12,.052),solid('Dark anodized aluminum',(.06,.036,.023,1),.42),.006)
edge.rotation_euler.y = -.22
etch, sweep, etch_mix = etched_mark()
etch.rotation_euler.y = -.22

# All three location joins pass the same near-camera mullion. It occludes the
# lens at the cut and the next clip starts from the identical dark surface.
shadow, _ = emission('Mullion in deep shadow', INK)
wipe = box('Structural mullion crossing', (0,0,-.34),(.80,2.25,.045),shadow,.016)
wipe.parent = camera
wipe.rotation_euler.z = -.08

def pose(name, t, view):
    portrait = view == 'tall'
    drift = ease(t)
    if name == 'entrance':
        cam_pos = (.02 + .51*drift, .016 + .085*drift, -1.78*drift)
        angles = (-.017*drift, -.061*drift, -.015*math.sin(t*math.pi))
    elif name == 'interior':
        cam_pos = (-.42 + .91*drift, -.05 + .10*drift, -.16 - 2.10*drift)
        angles = (.018*math.sin(t*7), .067 - .16*drift, .026*math.sin(t*math.tau))
    elif name == 'passage':
        cam_pos = (.26 - .81*drift, .21 - .37*drift, -.25 - 1.63*drift)
        angles = (-.034 + .068*drift, -.062 + .139*drift, -.023*math.sin(t*math.tau))
    else:
        cam_pos = (-.52 + .68*drift, .025 + .08*drift, -.30 - 1.32*drift)
        angles = (.017 - .021*drift, .056 - .067*drift, -.014*math.sin(t*math.pi))
    camera.location = cam_pos
    camera.rotation_euler = angles
    # The mark and pane are in world space, so they accelerate past the lens.
    x = .32 if portrait else .56
    door.location.x = x+.08*drift
    edge.location.x = x+.47+.08*drift
    etch.location = (x+.025+.08*drift, .085 if portrait else .085, -2.422)
    sweep.inputs[1].default_value = -.15 + 1.29*ease(t/.84)
    etch_mix.inputs[0].default_value = .65 - .56*ease((t-.68)/.22)
    lamp.location = (x-.42+.93*drift,.46,-1.57)
    if name != 'entrance':
        for ob in (door, edge, etch):
            ob.hide_render = True
    else:
        for ob in (door, edge, etch):
            ob.hide_render = False

    wipe.hide_render = True
    if name != 'entrance' and t < .135:
        wipe.hide_render = False
        wipe.location.x = -.78*ease(t/.135)
    elif name != 'contact' and t > .86:
        wipe.hide_render = False
        wipe.location.x = .78*(1-ease((t-.86)/.14))
    wipe.location.y = .01

def signal_pose(name, t, view, signals):
    # Coordinates follow practical lights and fiber runs visible in each plate.
    paths = {
        'wide': {
            'entrance': ((.67,.74),(.79,.49)), 'interior': ((.67,.46),(.965,.90)),
            'passage': ((.084,.93),(.176,.508)), 'contact': ((.91,.866),(1.26,.90)),
        },
        'tall': {
            'entrance': ((.58,.68),(.68,.46)), 'interior': ((.68,.45),(.88,.89)),
            'passage': ((.12,.87),(.38,.49)), 'contact': ((.83,.86),(1.25,.90)),
        },
    }
    start, end = paths[view][name]
    t = ease(t)
    x = start[0] + (end[0]-start[0])*t
    y = start[1] + (end[1]-start[1])*t - .058 * math.sin(math.pi*t)
    signals[0].default_value = (x,y,0)
    signals[1].default_value = (x,y,0)
    signals[2].default_value = (x-.035,.34-y*.28,0)

shots = os.getenv('RELAY_SHOTS', ','.join(FRAME_COUNTS)).split(',')
for view in os.getenv('RELAY_VIEWS', 'wide,tall').split(','):
    size = (1080,1440) if view == 'tall' else (1920,1080)
    scene.render.resolution_x,scene.render.resolution_y = size
    scene.render.resolution_percentage = int(os.getenv('RELAY_SCALE','100'))
    for name in shots:
        back, *signals = projection(name,view,size[0]/size[1])
        frames = [int(v) for v in os.getenv('RELAY_FRAMES', ','.join(map(str,range(FRAME_COUNTS[name])))).split(',')]
        dest = OUT / view / name
        dest.mkdir(parents=True,exist_ok=True)
        for i in frames:
            progress = i/(FRAME_COUNTS[name]-1)
            pose(name, progress, view)
            signal_pose(name, progress, view, signals)
            scene.render.filepath = str(dest / f'{i:03}.webp')
            bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(back,do_unlink=True)
