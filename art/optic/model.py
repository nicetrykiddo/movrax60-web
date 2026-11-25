"""Build the movrax60 optical relay. Run blender -b -P art/optic/model.py.

Dimensions are in model units. Blender's -Y is the front of the instrument.
The two assemblies share one mesh per material. The removable lid has its
own transform so its glass, edge seal and metalwork always move together.
"""
from collections import defaultdict
import json
import math
from pathlib import Path
from random import Random

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
PI = math.pi
TAU = 2 * PI
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = Random(612)
materials = {}
geometry = defaultdict(lambda: ([], [], []))
root_name, lid_name = "OpticalRelay", "ServiceCover"
assembly = root_name


def linear(channel):
    channel /= 255
    return channel / 12.92 if channel < 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def material(name, rgb, metal=0, rough=.4, emission=0, alpha=1):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes["Principled BSDF"]
    color = [linear(int(rgb[i:i+2], 16)) for i in (0, 2, 4)] + [1]
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Alpha"].default_value = alpha
    if emission:
        shader.inputs["Emission Color"].default_value = color
        shader.inputs["Emission Strength"].default_value = emission
    materials[name] = mat
    return name


shell = material("Manganese anodized", "4b5556", .72, .34)
black = material("Soft black nitrile", "202322", .05, .62)
steel = material("Machined aluminium", "bdc7c4", .89, .25)
titanium = material("Pewter satin", "748083", .76, .31)
ivory = material("Oyster ceramic", "d9d6c3", .28, .32)
ink = material("Front legend", "252d2d", .06, .52)
board = material("Mineral green soldermask", "34595b", .44, .36)
trace = material("Masked copper traces", "61817b", .58, .39)
gold = material("Unplated brass", "cda368", .84, .29)
wire = material("Amber enamel copper", "d57943", .8, .24)
white = material("Screenprint", "d0cfc0", .12, .45)
orange = material("Tangerine anodized", "dc6634", .46, .30)
photon = material("Fibre emission", "ff9b36", .05, .33, 2.8)
glass = material("Neutral smoked cover", "acccd0", .28, .14, alpha=.115)


def add(mat, vertices, faces, smooth=False):
    verts, polys, smooths = geometry[(assembly, mat)]
    offset = len(verts)
    verts.extend(vertices)
    polys.extend(tuple(offset+i for i in f) for f in faces)
    smooths.extend(smooth if isinstance(smooth, list) else [smooth]*len(faces))


def rounded(x, y, r, segments=3):
    points = []
    r = max(0.0002, min(x, y, r))
    for i, (cx, cy) in enumerate(((x-r, y-r), (-x+r, y-r), (-x+r, -y+r), (x-r, -y+r))):
        for j in range(segments+1):
            a = (i + j/segments) * PI/2
            points.append((cx + r*math.cos(a), cy + r*math.sin(a)))
    return points


def loft(mat, sections, center=(0, 0, 0), orient=lambda p:p, smooth=True):
    n = len(sections[0])
    v = [tuple(Vector(center) + Vector(orient(p))) for ring in sections for p in ring]
    f = [tuple(reversed(range(n)))]
    for j in range(len(sections)-1):
        for i in range(n):
            a, b = j*n+i, j*n+(i+1)%n
            f.append((a,b,b+n,a+n))
    f.append(tuple(range(len(v)-n,len(v))))
    add(mat, v, f, [False] + [smooth]*(len(f)-2) + [False])


def block(mat, pos, size, corner=.014, bevel=.009, orient=lambda p:p):
    w,d,h = size
    bevel = min(bevel,w/6,d/6,h/3)
    cuts = ((bevel,-h/2),(0,-h/2+bevel),(0,h/2-bevel),(bevel,h/2))
    sections = [[(x,y,z) for x,y in rounded(w/2-pad,d/2-pad,corner-pad,2)]
                for pad,z in cuts]
    loft(mat,sections,pos,orient,False)


def axis(axis):
    if axis == "x":
        return lambda p:(p[2],p[0],p[1])
    if axis == "front":
        return lambda p:(p[0],-p[2],p[1])
    return lambda p:p


def lathe(mat,pos,profile,side="z",n=20,angle=0,flat=False):
    sections = [[(r*math.cos(i*TAU/n+angle),r*math.sin(i*TAU/n+angle),z) for i in range(n)]
                for z,r in profile]
    loft(mat,sections,pos,axis(side),not flat)


def disc(mat,pos,r,h,side="z",n=20):
    b = min(h*.14,r*.10,.015)
    lathe(mat,pos,[(-h/2,r-b),(-h/2+b,r),(h/2-b,r),(h/2,r-b)],side,n)


def path(mat, pts, radius, n=6):
    # Parallel transport keeps each small wire circular through its bends.
    rings = []
    previous = None
    for i, point in enumerate(pts):
        tangent = (Vector(pts[min(len(pts)-1,i+1)])-Vector(pts[max(0,i-1)])).normalized()
        normal = previous
        if normal is None:
            normal = Vector((0,0,1)) if abs(tangent.z)<.97 else Vector((1,0,0))
        binormal = tangent.cross(normal).normalized()
        normal = binormal.cross(tangent).normalized()
        rings.append([tuple(Vector(point)+radius*(normal*math.cos(j*TAU/n)+binormal*math.sin(j*TAU/n))) for j in range(n)])
        previous = normal
    loft(mat,rings)


def flatline(mat, pts, width, z):
    vs = []
    for i,(x,y) in enumerate(pts):
        p = Vector(pts[min(len(pts)-1,i+1)])-Vector(pts[max(0,i-1)])
        normal = Vector((-p.y,p.x)).normalized() * width/2
        vs.extend([(x+normal.x,y+normal.y,z),(x-normal.x,y-normal.y,z)])
    add(mat,vs,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(len(pts)-1)])


def screw(pos, side="z", radius=.052):
    x,y,z = pos
    orient = axis(side)
    disc(titanium,pos,radius,.023,side,12)
    recess = tuple(Vector(pos)+Vector(orient((0,0,.011))))
    lathe(black,recess,[(0,radius*.42),(.001,radius*.42)],side,6,.48,True)


def legend(txt,pos,scale,mat,front=False,mono=False):
    c = bpy.data.curves.new("Silkscreen type","FONT")
    c.body, c.size, c.resolution_u = txt,scale,3
    if mono:
        font = Path("/usr/share/fonts/TTF/DejaVuSansMono.ttf")
        if font.exists():
            c.font = bpy.data.fonts.load(str(font),check_existing=True)
    obj = bpy.data.objects.new("Legend "+txt,c)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    if front:
        obj.rotation_euler.x = PI/2
    bpy.context.view_layer.update()
    eo = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = eo.to_mesh()
    add(mat,[tuple(obj.matrix_world@v.co) for v in mesh.vertices],[tuple(poly.vertices) for poly in mesh.polygons])
    eo.to_mesh_clear()
    bpy.data.objects.remove(obj,do_unlink=True)


# Lower extruded casting and recessed rubber isolation feet.
block(black,(0,0,-.556),(4.00,2.17,.11),.11,.024)
block(shell,(0,0,-.362),(4.10,2.27,.35),.13,.053)
block(black,(0,0,-.188),(3.99,2.17,.054),.09,.012)
for x in (-1.73,1.73):
    for y in (-.86,.86):
        disc(black,(x,y,-.609),.153,.084)
        disc(titanium,(x,y,-.568),.145,.033)
block(board,(-.015,.035,-.132),(3.88,1.94,.075),.094,.014)
for x in (-1.78,1.71):
    for y in (-.77,.81):
        disc(gold,(x,y,-.084),.085,.044,n=16)
        screw((x,y,-.049))

# Anodized handles are mechanically captured in the casting, outside the cover.
for x in (-1.921,1.921):
    for y in (-.94,.94):
        disc(black,(x,y,-.142),.112,.105)
        lathe(titanium,(x,y,0),[(-.13,.081),(.25,.077),(.27,.066)],n=16)
    pts = [(x,-.94,.08),(x,-.94,.225)]
    pts += [(x,-.77-.17*math.cos(a*PI/12),.225+.17*math.sin(a*PI/12)) for a in range(1,7)]
    pts += [(x,.77,.395)]
    pts += [(x,.77+.17*math.sin(a*PI/12),.225+.17*math.cos(a*PI/12)) for a in range(1,7)]
    pts += [(x,.94,.08)]
    path(steel,pts,.049,10)

# Paired toroidal chokes. The windings wrap the ferrite through its opening.
for cx,cy,bigr,smallr,turns in ((-.86,.12,.369,.115,31),(.14,.36,.245,.082,22)):
    z = -.08+smallr+.065
    core = [(cx+bigr*math.cos(i*TAU/80),cy+bigr*math.sin(i*TAU/80),z) for i in range(81)]
    path(black,core,smallr,10)
    for i in range(turns):
        t = TAU*i/turns
        winding = []
        for j in range(15):
            q=TAU*j/14
            a=t+q/turns
            r=bigr+(smallr+.010)*math.cos(q)
            winding.append((cx+r*math.cos(a),cy+r*math.sin(a),z+(smallr+.010)*math.sin(q)))
        path(wire,winding,.022 if turns>25 else .017,7)
    disc(black,(cx,cy,-.005),bigr*.37,.132)
    disc(titanium,(cx,cy,.070),bigr*.31,.025)
    screw((cx,cy,.093),radius=.052)

# A machined comb heat sink, power packages and their soldered terminals.
block(titanium,(1.00,.46,-.018),(.75,.60,.14),.029,.014)
for i in range(11):
    block(shell,(.69+i*.062,.46,.089),(.031,.57,.222),.013,.006)
for cx in (-1.44,-.86,-.26,.31):
    cy=-.515
    for j in range(6):
        xx=cx+(j-2.5)*.046
        for yy in (cy-.139,cy+.139):
            block(steel,(xx,yy,-.056),(.030,.091,.035),.004,.004)
    block(black,(cx,cy,-.008),(.315,.230,.117),.024,.011)
    flatline(white,[(cx-.113,cy-.061),(cx-.113,cy+.061)],.011,.053)
for i in range(24):
    x=-1.53+i*.128
    flatline(trace,[(x,-.79),(x,-.734),(x+.05,-.68),(x+.05,-.62)],.010,-.091)
    disc(gold,(x,-.795,-.089),.014,.008,n=7)
for i in range(16):
    x=.44+i*.061
    dest=.94+i*.021
    flatline(trace,[(x,-.49),(x,-.41+i*.014),(dest,-.15+i*.012),(dest,.0)],.009,-.091)
for i in range(8):
    y=-.62+i*.158
    flatline(trace,[(-1.7,y),(-1.55,y),(-1.49,y+.06),(-1.36,y+.06)],.011,-.091)
for i in range(30):
    x=.53+(i%10)*.087
    y=-.72+math.floor(i/10)*.084
    if i%6==0:
        continue
    block(titanium,(x,y,-.055),(.076,.039,.023),.003,.003)
    block(ivory if i%3 else black,(x,y,-.037),(.044,.04,.027),.003,.003)

# Stepped barrel and ceramic ferrule on the right side, aligned with incoming fibres.
orient_x=axis("x")
block(shell,(1.77,0,-.024),(1.12,.42,.414),.08,.034,orient_x)
for y,outer in ((-.362,.114),(.362,.114),(0,.174)):
    lathe(gold,(1.88,y,0),[(.0,outer*1.15),(.125,outer*1.15)],"x",6,PI/6,True)
    lathe(titanium,(1.88,y,0),[(.12,outer),(.14,outer*.86),(.17,outer*.86),(.18,outer*.99),
                                 (.22,outer*.99),(.23,outer*.82)],"x",24)
    disc(black,(2.115,y,0),outer*.77,.041,"x")
    disc(ivory,(2.138,y,0),outer*.43,.030,"x")
    disc(photon,(2.162,y,0),outer*.23,.025,"x")
# Rear ceramic header and gold-plated pins.
block(ivory,(-.88,.735,.042),(1.15,.178,.256),.034,.016)
for i in range(13):
    x=-1.37+i*.082
    block(black,(x,.72,.169),(.051,.072,.011),.007,.002)
    block(gold,(x,.722,.177),(.019,.055,.020),.004,.003)
for i in range(3):
    x=.62+i*.26
    disc(black,(x,-.085,-.012),.086,.125)
    disc(steel,(x,-.085,.066),.084,.065)
    flatline(black,[(x-.044,-.085),(x+.044,-.085)],.008,.100)
legend("RX  /  60",(-1.58,-.876,-.09),.069,white,mono=True)
legend("T1",(-1.49,.43,-.089),.088,white)
legend("U04",(.55,-.52,-.090),.065,white)

# Front fascia and inlaid typography: front faces the viewer in the hero.
orient_front=axis("front")
block(ivory,(0,-1.133,-.352),(3.80,.318,.042),.036,.010,orient_front)
legend("movrax60",(-1.58,-1.157,-.370),.196,ink,front=True)
legend("OPTICAL SWITCH",(-.452,-1.157,-.343),.076,ink,front=True,mono=True)
legend("MX-06  /  SERIES 01",(-.452,-1.157,-.421),.055,ink,front=True,mono=True)
for i in range(9):
    block(black,(.393+i*.072,-1.157,-.365),(.037,.134,.005),.016,.001,orient_front)
block(ink,(1.246,-1.159,-.349),(.306,.148,.014),.039,.005,orient_front)
for i in range(3):
    disc(photon if i<2 else orange,(1.157+i*.09,-1.175,-.349),.025,.014,"front",12)
for x in (-1.79,1.78):
    screw((x,-1.158,-.345),"front",.048)

# Team mascot as enamel islands. Decimate sub-pixel contour detail before triangulation.
from mathutils.geometry import tessellate_polygon
emblem=json.loads((ROOT/"art/pin/enamel.json").read_text())
for polygon in emblem:
    loops=[]
    for ring in polygon:
        loop=[]
        for x,y in ring[:-1]:
            p=Vector((x,y,0))
            if not loop or (p-loop[-1]).length>13:
                loop.append(p)
        if len(loop)>2:
            loops.append(loop)
    if loops:
        verts=[(1.565+(p.x-627)*.000188,-1.157,-.348+(p.y-627)*.000188) for loop in loops for p in loop]
        add(ink,verts,tessellate_polygon(loops))

# Mounted threaded sockets receive the lid posts. The gasket lies under the
# metal and the visible joint separates cleanly when the cover is lifted.
for x in (-1.59,1.42):
    for y in (-.692,.792):
        disc(black,(x,y,-.053),.102,.080)
        lathe(gold,(x,y,0),[(-.018,.075),(.023,.085),(.045,.063),
                             (.277,.061),(.291,.074),(.317,.074)],n=6,angle=PI/6,flat=True)
        disc(black,(x,y,.313),.059,.014)
# Heat shrink and a fanned harness route the three ferrules back to the board.
for i in range(3):
    y=(i-1)*.36
    pts=[(1.775,y,-.006),(1.646,y,-.007),(1.56,y-.045,.006),
         (1.47,y-.14,.009),(1.31,y-.23,-.008),(1.22,y-.24,-.045)]
    path(orange if i==1 else black,pts,.023,8)
    disc(black,(1.735,y,-.005),.035,.066,"x",10)
    disc(gold,(1.21,y-.24,-.073),.056,.035,n=12)
# Extrusion ribs run to the rear panel on both side walls.
for x in (-2.051,2.051):
    for z in (-.432,-.390,-.348):
        for y in (-.713,.713):
            block(black,(x,y,z),(.588,.014,.004),.006,.001,orient_x)
    if x > 0:
        for y in (-.97,.97):
            screw((x,y,-.335),"x",.037)

# Focused service window: stepped acrylic, gasket and metal perimeter edge.
assembly=lid_name
for x in (-1.59,1.42):
    for y in (-.692,.792):
        lathe(gold,(x,y,0),[(.31,.038),(.465,.053),(.495,.049)],n=12)
block(glass,(-.084,.05,.503),(3.20,1.61,.042),.125,.016)
# Only the front and rear edges receive full length brushed extrusions.
for y in (-.711,.811):
    block(titanium,(-.084,y,.508),(2.98,.045,.057),.021,.012)
for x in (-1.626,1.458):
    block(shell,(x,.05,.507),(.079,1.458,.064),.028,.014)
for x in (-1.59,1.42):
    for y in (-.692,.792):
        screw((x,y,.536),radius=.044)
for i in range(11):
    x=-1.32+i*.063
    flatline(white,[(x,-.624),(x,-.590 if i%5 else -.556)],.007,.525)
legend("06",(-1.41,-.515,.525),.090,white,mono=True)
legend("OPTICAL   /   A",(.797,-.638,.525),.056,white,mono=True)
for i in range(3):
    x=1.23+i*.039
    flatline(orange,[(x,-.60),(x+.061,-.503)],.016,.526)

# Emit compact batches with the cover parented in glTF's Y-up coordinate system.
def empty(name):
    obj=bpy.data.objects.new(name,None)
    bpy.context.scene.collection.objects.link(obj)
    return obj

root=empty(root_name)
lid=empty(lid_name)
lid.parent=root
for (group,mat),(verts,faces,shading) in geometry.items():
    mesh=bpy.data.meshes.new(group+" "+mat)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth",shading)
    ob=bpy.data.objects.new(mesh.name,mesh)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent=lid if group==lid_name else root
    mesh.materials.append(materials[mat])
target=ROOT/"public/models/relay.glb"
target.parent.mkdir(exist_ok=True,parents=True)
bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",export_texcoords=False,
                          export_animations=False,export_tangents=False,export_yup=True)
print("Wrote",target,target.stat().st_size,"bytes")
