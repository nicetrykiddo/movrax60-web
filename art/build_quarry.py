"""Rebuild the editable weather quarry and its two Cycles background plates.
From the repository root run: blender -b -P art/build_quarry.py
"""
import bpy
import math
import os
import random
from pathlib import Path
from mathutils import Vector, noise
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"
random.seed(62583)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = int(os.getenv("QUARRY_SAMPLES", "48"))
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 2
scene.render.threads_mode = "FIXED"
scene.render.threads = 5
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "OPTIX"
    prefs.refresh_devices()
    for dev in prefs.devices:
        dev.use = dev.type == "OPTIX"
    if any(d.use for d in prefs.devices):
        scene.cycles.device = "GPU"
except (TypeError, RuntimeError):
    pass
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.05
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 87
scene.render.resolution_percentage = int(os.getenv("QUARRY_SCALE", "100"))

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

walls = collection("01  |  Extraction benches")
surfaces = collection("02  |  Quarry floor and fractured seams")
chips = collection("03  |  Talus and limestone chips")
stage = collection("04  |  Sky, sun and framing")

def nodes(material):
    material.use_nodes = True
    return material.node_tree.nodes, material.node_tree.links

def stone(name, palette, ground=False):
    mat = bpy.data.materials.new(name)
    ns, links = nodes(mat)
    p = ns.get("Principled BSDF")
    p.inputs["Roughness"].default_value = .88
    coords = ns.new("ShaderNodeTexCoord").outputs["Object"]
    def stretched(vec, dims):
        n = ns.new("ShaderNodeVectorMath")
        n.operation = "MULTIPLY"
        links.new(vec,n.inputs[0])
        n.inputs[1].default_value=dims
        return n.outputs[0]
    def cloud(vec, scale, detail=3, rough=.62):
        n=ns.new("ShaderNodeTexNoise")
        links.new(vec,n.inputs["Vector"])
        n.inputs["Scale"].default_value=scale
        n.inputs["Detail"].default_value=detail
        n.inputs["Roughness"].default_value=rough
        return n.outputs["Fac"]
    def mix(a,b,weight,kind="MIX"):
        n=ns.new("ShaderNodeMixRGB"); n.blend_type=kind; n.inputs[0].default_value=weight
        links.new(a,n.inputs[1]); links.new(b,n.inputs[2])
        return n.outputs[0]
    def ramp(socket, stops):
        n=ns.new("ShaderNodeValToRGB"); links.new(socket,n.inputs[0])
        cr=n.color_ramp
        for i,(pos,color) in enumerate(stops):
            e=cr.elements[i] if i<2 else cr.elements.new(pos)
            e.position=pos; e.color=(*color,1)
        return n.outputs[0]
    large=cloud(stretched(coords,(.64,.9,1.65)),.44,5)
    beds=cloud(stretched(coords,(.35,.38,11)),1.5,5)
    scoring=cloud(stretched(coords,(18,15,.13)),2.3,3)
    mineral=cloud(coords,18,3)
    fine=cloud(coords,72,2)
    value=mix(large,beds,.23 if ground else .46)
    value=mix(value,mineral,.2)
    if not ground:
        value=mix(value,scoring,.12)
    col=ramp(value,[(.29,palette[0]),(.51,palette[1]),(.74,palette[2])])
    links.new(col,p.inputs["Base Color"])
    bump=ns.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value=.36 if ground else .54
    bump.inputs["Distance"].default_value=.058 if ground else .13
    links.new(mix(beds if not ground else large,scoring if not ground else mineral,.46),bump.inputs["Height"])
    grain=ns.new("ShaderNodeBump")
    grain.inputs["Strength"].default_value=.31
    grain.inputs["Distance"].default_value=.018
    links.new(mix(mineral,fine,.46),grain.inputs["Height"])
    links.new(bump.outputs[0],grain.inputs["Normal"])
    links.new(grain.outputs[0],p.inputs["Normal"])
    return mat

fresh=stone("Freshly cut Jurassic limestone",[(.17,.132,.086),(.52,.41,.265),(.86,.73,.53)])
old=stone("Weathered outer face",[(.091,.079,.061),(.31,.272,.20),(.63,.55,.405)])
chalk=stone("Pale calcite and calcareous dust",[(.29,.22,.14),(.58,.48,.335),(.88,.77,.58)],True)
raw=stone("Torn bedrock",[(.15,.12,.088),(.37,.30,.205),(.65,.55,.398)])
floor_mat=stone("Wheel-polished aggregate",[(.21,.165,.113),(.46,.365,.239),(.73,.61,.43)],True)

def photostone(mat, name, size, weight, relief):
    ns,links=nodes(mat)
    bsdf=ns.get("Principled BSDF")
    prev=bsdf.inputs["Base Color"].links[0].from_socket
    base=bsdf.inputs["Normal"].links[0].from_socket
    coords=ns.new("ShaderNodeTexCoord")
    scale=ns.new("ShaderNodeVectorMath"); scale.operation="MULTIPLY"
    scale.inputs[1].default_value=(1/size,1/size,1/size)
    links.new(coords.outputs["Object"],scale.inputs[0])
    def texture(role):
        node=ns.new("ShaderNodeTexImage");node.projection="BOX"; node.projection_blend=.17
        node.image=bpy.data.images.load(str(ROOT/"art"/"materials"/(name+"-"+role+".jpg")),check_existing=True)
        if role=="displacement": node.image.colorspace_settings.name="Non-Color"
        links.new(scale.outputs[0],node.inputs["Vector"])
        return node.outputs[0]
    pigment=texture("diffuse"); hue=ns.new("ShaderNodeHueSaturation")
    hue.inputs["Saturation"].default_value=.61; links.new(pigment,hue.inputs["Color"])
    color=ns.new("ShaderNodeMixRGB");color.inputs[0].default_value=weight
    links.new(prev,color.inputs[1]);links.new(hue.outputs[0],color.inputs[2]);links.new(color.outputs[0],bsdf.inputs["Base Color"])
    height=texture("displacement");bump=ns.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.78
    bump.inputs["Distance"].default_value=relief
    links.new(height,bump.inputs["Height"]);links.new(base,bump.inputs["Normal"]);links.new(bump.outputs[0],bsdf.inputs["Normal"])

photostone(fresh,"marble_cliff_01",8.8,.76,.20)
photostone(old,"marble_cliff_06",10.0,.92,.31)
photostone(raw,"marble_cliff_03",7.4,.93,.41)
photostone(chalk,"quarry_wall_02",4.2,.42,.12)
photostone(floor_mat,"gravel_floor_02",2.6,.60,.053)

def mesh_obj(name,verts,faces,coll,mats):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.materials.clear()
    for mat in mats: mesh.materials.append(mat)
    obj=bpy.data.objects.new(name,mesh); coll.objects.link(obj)
    return obj

def n3(x,y,z):
    return noise.noise(Vector((x,y,z)),noise_basis="PERLIN_ORIGINAL")

def height(x,y):
    return .026*n3(x*.68,y*.68,8)+.055*n3(x*.20,y*.20,3)+.012*n3(x*1.9,y*1.9,2)

# Sawn turns between separate extraction runs. Work the three faces independently;
# the stepped topography and the stone itself have different frequencies.
def block(label,x0,x1,y0,y1,z0,z1,mat,degrees=0,distress=.32,natural=False):
    w=x1-x0; d=y1-y0; h=z1-z0; phase=random.uniform(-46,46)
    mx=(x0+x1)*.5; my=(y0+y1)*.5; angle=math.radians(degrees)
    nx=max(6,round(w*3.1)); ny=max(4,round(d*2.9)); nz=max(5,round(h*3.8))
    verts=[]; faces=[]; indices=[]; cached={}
    def vert(i,j,k):
        key=(i,j,k)
        if key in cached: return cached[key]
        u=i/nx; v=j/ny; t=k/nz
        x=x0+w*u; y=y0+d*v; z=z0+h*t
        topnoise=n3(x*.56,y*.52,phase)
        broad=n3(x*.9,z*.83,phase+8)
        fine=n3(x*3.4,z*3.1,phase+3)
        # Pitched, spalled rim on each newly sawn face.
        rim=max(0,1-v*d/.52)*t**8
        seam=(.5+.5*n3(x*.45,z*.14,phase+10))
        y+=distress*(1-v)**2*(broad*1.2+fine*.26+rim*(1+topnoise)*.72+seam*t*.62)
        z+=distress*t*t*(topnoise*1.3+n3(x*2.2,y*2.7,phase+4)*.29-rim*(.7+topnoise))
        if natural:
            y += .60*(1-v)**1.7*n3(x*.64,z*.55,phase+14)
            z += .35*t*t*n3(x*.34,y*.35,phase+15)
        x+=.07*(n3(y*1.6,z*.6,phase+16))
        idx=len(verts); cached[key]=idx
        verts.append((mx+(x-mx)*math.cos(angle)-(y-my)*math.sin(angle),my+(x-mx)*math.sin(angle)+(y-my)*math.cos(angle),z))
        return idx
    def quad(a,b,c,d,mi):
        # Triangulated torn edges, continuous weathered surfaces.
        faces.extend(((a,b,c),(a,c,d))); indices.extend((mi,mi))
    for i in range(nx):
        for j in range(ny):
            quad(vert(i,j,nz),vert(i+1,j,nz),vert(i+1,j+1,nz),vert(i,j+1,nz),1)
    for i in range(nx):
        for k in range(nz):
            quad(vert(i,0,k),vert(i+1,0,k),vert(i+1,0,k+1),vert(i,0,k+1),0)
    for j in range(ny):
        for k in range(nz):
            quad(vert(0,j+1,k),vert(0,j,k),vert(0,j,k+1),vert(0,j+1,k+1),0)
            quad(vert(nx,j,k),vert(nx,j+1,k),vert(nx,j+1,k+1),vert(nx,j,k+1),0)
    ob=mesh_obj(label,verts,faces,walls,[mat,chalk])
    for p,idx in zip(ob.data.polygons,indices):
        p.material_index=idx; p.use_smooth=True
    ob.data.set_sharp_from_angle(angle=math.radians(67))

def run(label,xs,ys,zbase,heights,depth,mats,rough):
    for i,y in enumerate(ys):
        block(label+" %02d"%(i+1),xs[i],xs[i+1]+.02,y,y+depth,zbase,heights[i],mats[i%len(mats)],distress=rough*.72,natural=rough>.6)

# A high left return closes one side of the bowl. The central wall drops away
# into an off-axis ramp, giving the hero clean sky and an asymmetrical horizon.
run("Upper escarpment",[-47,-29,-16,-7,2,11,23,44],[21,21,23,25,27,25,21],3.0,[13,9.5,5.95,4.2,3.25,4.25,7.6],6,[raw,old],1.8)
run("Weathered bed",[-43,-24,-14,-4,7,19,37],[14,14.7,17,18,18.9,16.5],1.8,[10.8,9.15,5.6,4.2,3.25,4.85],8,[old,raw],.83)
run("Diagonal middle bench",[-42,-25,-13,-4,2,10,25,43],[8.8,9.1,10.8,13.6,14.5,12,10.3],-.45,[7.5,7.35,4.8,3.75,3.25,4.25,6.2],9,[fresh,fresh,raw],.58)
run("Lower extraction face",[-40,-23,-16,-11,-5.6,8.9,15,27,42],[3.8,3.8,4.4,7.85,8.2,9.4,7.4,6.7],-.55,[4.6,4.55,3.85,2.82,2.75,2.15,3.45,3.55],8,[fresh,fresh,raw,fresh],.34)

# Floor with gentle undulation, lit by the same physical sun as the faces.
vs=[]; fs=[]; nx=120; ny=88
for j in range(ny+1):
    for i in range(nx+1):
        x=-96+i*1.6; y=-110+j*1.88; vs.append((x,y,height(x,y)))
for j in range(ny):
    for i in range(nx):
        a=j*(nx+1)+i; fs.append((a,a+1,a+nx+2,a+nx+1))
ground=mesh_obj("Broad limestone apron",vs,fs,surfaces,[floor_mat])
for poly in ground.data.polygons: poly.use_smooth=True

# The fissure ribbons fork and taper toward their free tips.
crack=bpy.data.materials.new("Dust in shallow fractures"); crack.diffuse_color=(.20,.15,.098,1)
vs=[]; fs=[]
def fissure(x,y,a,length,w,fork=True):
    count=max(5,int(length*3)); prev=None
    for i in range(count+1):
        a+=random.uniform(-.34,.34); thick=w*(max(0,math.sin(math.pi*i/count))**.5+.035)*random.uniform(.65,1.35)
        idx=len(vs); z=height(x,y)+.013
        dx=math.cos(a+math.pi/2)*thick; dy=math.sin(a+math.pi/2)*thick
        vs.extend([(x+dx,y+dy,z),(x-dx,y-dy,z)])
        if prev is not None: fs.append((prev,prev+1,idx+1,idx))
        prev=idx
        if fork and i==count//2: fissure(x,y,a+.76,length*.38,w*.45,False)
        x+=math.cos(a)*length/count; y+=math.sin(a)*length/count
for _ in range(75):
    fissure(random.uniform(-26,27),random.uniform(-14,13),random.uniform(-2.8,2.8),random.uniform(.8,5.7),random.uniform(.005,.019))
mesh_obj("Hairline bedding joints",vs,fs,surfaces,[crack])

# Scatter chips in clusters along wall feet. Bake combined geometry, preserving
# an editable mesh per material rather than thousands of object instances.
vs=[]; fs=[]
def fragment(x,y,z,r,flatten):
    start=len(vs); sides=random.choice([4,5,6,7]); t=random.random()*6; rr=r*random.uniform(.63,1.43)
    for j in range(2):
        for i in range(sides):
            a=t+2*math.pi*i/sides+random.uniform(-.17,.17); dist=random.uniform(.72,1.14)*(1 if j==0 else random.uniform(.43,.85))
            vs.append((x+math.cos(a)*dist*r+j*r*.1,y+math.sin(a)*dist*rr,z+(random.uniform(-.14,-.03) if j==0 else random.uniform(.37,.92))*r*flatten))
    fs.append(tuple(start+sides+i for i in range(sides)))
    for i in range(sides): fs.append((start+i,start+(i+1)%sides,start+sides+(i+1)%sides,start+sides+i))
for _ in range(54):
    cx=random.uniform(-32,36); cy=random.uniform(2.8,9.8) if random.random()<.73 else random.uniform(-18,5)
    for q in range(random.randint(32,176)):
        x=random.gauss(cx,random.uniform(.28,2.3)); y=random.gauss(cy,.53)
        radius=random.choices([random.uniform(.012,.068),random.uniform(.09,.34),random.uniform(.38,.88)],weights=[94,5.7,.3])[0]
        fragment(x,y,height(x,y),radius,random.uniform(.30,.85))
mesh_obj("Rockfall along bench foot",vs,fs,chips,[chalk])

# Direction-based outdoor fill and a narrow direct sun keep shadows cool.
world=bpy.data.worlds.new("Dry summer atmosphere"); scene.world=world; world.use_nodes=True
ns=world.node_tree.nodes; lk=world.node_tree.links
sky=ns.new("ShaderNodeTexSky")
try:
    sky.sky_type='NISHITA'
except TypeError:
    sky.sky_type='MULTIPLE_SCATTERING'
for prop,val in [('sun_elevation',math.radians(36)),('sun_rotation',math.radians(156)),('altitude',175),('air_density',1.1),('dust_density',.67),('ozone_density',1.05),('sun_disc',False)]:
    if hasattr(sky,prop): setattr(sky,prop,val)
bg=ns.get("Background"); lk.new(sky.outputs["Color"],bg.inputs["Color"]); bg.inputs["Strength"].default_value=.10
sun=bpy.data.lights.new("Warm direct sun","SUN"); sun.energy=3.8; sun.angle=math.radians(2.1); sun.color=(1,.78,.56)
so=bpy.data.objects.new("Sun · northwest",sun); stage.objects.link(so); so.rotation_euler=Vector((.87,.32,-.41)).to_track_quat("-Z","Y").to_euler()

anchor=bpy.data.objects.new("Water landing | world origin",None); stage.objects.link(anchor)
views=[("Wide frame",1600,960,26.1,Vector((9,-24,5.95)),Vector((0,3,3.1)),"quarry"),("Portrait frame",800,1200,18.4,Vector((8,-24,6.4)),Vector((0,3,3.65)),"quarry-tall")]
cameras=[]
for name,w,h,extent,origin,target,stem in views:
    data=bpy.data.cameras.new(name); data.type="ORTHO"; data.ortho_scale=extent; data.clip_end=200
    cam=bpy.data.objects.new(name,data); stage.objects.link(cam); cam.location=origin+(origin-target).normalized()*72; cam.rotation_euler=(target-origin).to_track_quat("-Z","Y").to_euler()
    scene.camera=cam; scene.render.resolution_x=w; scene.render.resolution_y=h
    bpy.context.view_layer.update()
    projected=world_to_camera_view(scene,cam,Vector((0,0,0)))
    camera_right=cam.rotation_euler.to_matrix() @ Vector((1,0,0)); camera_up=cam.rotation_euler.to_matrix() @ Vector((0,1,0))
    cam.location+=camera_right*((projected.x-.55)*extent*min(1,w/h))+camera_up*((projected.y-.27)*extent*min(1,h/w))
    bpy.context.view_layer.update(); cameras.append(cam)
    print(stem,"landing",tuple(world_to_camera_view(scene,cam,Vector((0,0,0)))),flush=True)
scene.camera=cameras[0]
scene.render.resolution_x=views[0][1]; scene.render.resolution_y=views[0][2]
scene.render.filepath="//../public/quarry.webp"
if os.getenv("QUARRY_PREVIEW") is None:
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"art"/"weather-quarry.blend"),compress=True)
for cam,view in zip(cameras,views):
    name,w,h,extent,origin,target,stem=view
    scene.camera=cam; scene.render.resolution_x=w; scene.render.resolution_y=h
    out=Path(os.getenv("QUARRY_PREVIEW",str(OUT)))
    scene.render.filepath=str(out/(stem+".webp"))
    bpy.ops.render.render(write_still=True)
    print("Saved",scene.render.filepath,flush=True)
