import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type XYZ = [number, number, number];
const half = Math.PI * .5;
const metal = (color: number, roughness: number, metalness = .85) =>
  new T.MeshStandardMaterial({color, roughness, metalness});

function add(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, position: XYZ, rotation: XYZ = [0,0,0]) {
  const mesh = new T.Mesh(geometry,material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

// The fasteners, knurling and washers share buffer draws by finish.
function batch(parent: T.Group) {
  const batches = new Map<T.Material,T.BufferGeometry[]>();
  for (const item of [...parent.children]) {
    if (!(item instanceof T.Mesh) || item.material.transparent) continue;
    item.updateMatrix();
    const transformed = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
    transformed.applyMatrix4(item.matrix);
    transformed.deleteAttribute('uv');
    const group = batches.get(item.material) ?? [];
    group.push(transformed);
    batches.set(item.material, group);
    item.geometry.dispose();
    parent.remove(item);
  }
  for (const [material, chunks] of batches) {
    const joined = mergeGeometries(chunks);
    if (joined) parent.add(new T.Mesh(joined,material));
    chunks.forEach(g=>g.dispose());
  }
}

// A procedural optical breadboard. Filter its subpixel machining marks using
// screen-space derivatives so the distant surface doesn't crawl while scrolling.
function makeTable() {
  const shader = new T.ShaderMaterial({
    vertexShader: `varying vec3 p; void main(){vec4 world=modelMatrix*vec4(position,1.);p=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `
      varying vec3 p;
      float hash(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float pool(vec2 xy, vec2 centre, vec2 scale){vec2 d=(xy-centre)/scale;return exp(-dot(d,d));}
      float boxShadow(vec2 p,vec2 centre,vec2 size,float softness){return 1.-smoothstep(-.12,softness,length(max(abs(p-centre)-size,0.)));}
      void main(){
        vec2 xy=p.xz;
        float soft=pool(xy,vec2(.9,-1.8),vec2(6.1,6.7));
        float amber=pool(xy,vec2(-1.2,1.0),vec2(4.3,1.8));
        float white=pool(xy,vec2(4.9,-4.2),vec2(3.2,4.6));
        vec3 light=vec3(.004,.011,.012)+vec3(.017,.047,.048)*soft+vec3(.006,.025,.027)*white+vec3(.033,.013,.003)*amber;
        vec2 uv=xy/.54;
        vec2 field=fract(uv+.5)-.5;
        float r=length(field), aa=max(.003,length(fwidth(uv))*.55);
        float hole=1.-smoothstep(.052-aa,.052+aa,r);
        float rim=(1.-smoothstep(.069-aa,.069+aa,r))*(1.-hole);
        float detail=1.-smoothstep(.07,.23,aa);
        light*=1.-.72*hole*detail;
        light+=vec3(.024,.038,.034)*rim*(.45+.55*clamp((field.x+field.y)*12.,0.,1.))*detail;
        float footprint=boxShadow(xy,vec2(-.02,.03),vec2(1.86,1.05),.67);
        light*=1.-.82*footprint;
        float grain=hash(floor(xy*220.));
        light*=1.+(grain-.5)*.13*(1.-smoothstep(.008,.028,fwidth(xy.x)));
        float stripe=xy.x+.54*xy.y;
        light+=vec3(.015,.026,.022)*exp(-pow((stripe-1.72)/.85,2.))*soft;
        gl_FragColor=vec4(light,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const table = new T.Mesh(new T.PlaneGeometry(140,140),shader);
  table.rotation.x = -half;
  table.position.y = -.705;
  return table;
}

const cylinder = (radius: number, depth:number, segments=48) => new T.CylinderGeometry(radius,radius,depth,segments);
const roundBox = (w:number,h:number,d:number,bevel=.035) => new RoundedBoxGeometry(w,h,d,2,bevel);

export function makeBench(prismPosition:T.Vector3, end:T.Vector3, direction:T.Vector3) {
  const stage=new T.Group();
  stage.add(makeTable());
  const black=metal(0x263531,.43), graphite=metal(0x414945,.32), brass=metal(0xa27b4f,.29);
  const steel=metal(0xb9b6a5,.29), dark=metal(0x081315,.59,.5);
  const pin=new T.MeshStandardMaterial({color:0xffd1a2,emissive:0xff9144,emissiveIntensity:.6,roughness:.24});
  const glass=new T.MeshPhysicalMaterial({color:0x97dcd2,metalness:.14,roughness:.095,transparent:true,opacity:.42,depthWrite:false,clearcoat:1,envMapIntensity:1.6,side:T.DoubleSide});

  // Adjustable triangular prism mounted in a three-point kinematic cradle.
  const spectrometer = new T.Group();
  spectrometer.position.set(prismPosition.x,-.695,prismPosition.z-.4);
  stage.add(spectrometer);
  add(spectrometer,roundBox(2.04,.12,1.51),black,[0,.065,0]);
  add(spectrometer,cylinder(.78,.12,72),graphite,[0,.18,0]);
  add(spectrometer,cylinder(.74,.036,72),brass,[0,.255,0]);
  add(spectrometer,cylinder(.71,.09,72),black,[0,.307,0]);
  for(let i=0;i<72;i++) {
    const a=i*Math.PI/36;
    add(spectrometer,new T.BoxGeometry(.009,.006,i%6?.036:.083),steel,[Math.sin(a)*.68,.355,Math.cos(a)*.68],[0,a,0]);
  }
  for(const x of [-.81,.81]) for(const z of [-.56,.56]) {
    add(spectrometer,cylinder(.074,.018,24),steel,[x,.138,z]);
    add(spectrometer,cylinder(.029,.004,6),dark,[x,.15,z]);
  }
  const prism=new T.Group();
  spectrometer.add(prism);
  for(const a of [0,2.094,4.189]) {
    add(prism,cylinder(.075,.37,24),brass,[Math.sin(a)*.61,.54,Math.cos(a)*.61]);
    add(prism,cylinder(.11,.048,32),steel,[Math.sin(a)*.61,.74,Math.cos(a)*.61]);
  }
  const prismSection=new T.Shape();
  prismSection.moveTo(-.61,0);prismSection.lineTo(.61,0);prismSection.lineTo(.02,1.12);prismSection.closePath();
  const cut=new T.ExtrudeGeometry(prismSection,{depth:.64,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2});
  add(prism,cut,glass,[0,.385,-.32]);
  const outline = new T.EdgesGeometry(cut,25);
  const glint = new T.LineSegments(outline,new T.LineBasicMaterial({color:0xb4f4e7,transparent:true,opacity:.45}));
  glint.position.set(0,.385,-.32);prism.add(glint);
  batch(prism);batch(spectrometer);

  // Fibre receiver: polished end-caps, insulated sockets and a finned heat sink.
  const receiver=new T.Group();
  const inward=direction.clone().setY(0).normalize();
  receiver.rotation.y=Math.atan2(-inward.x,-inward.z);
  receiver.position.copy(end).addScaledVector(inward,.74);
  stage.add(receiver);
  const h=Math.max(.72, end.y+.71);
  add(receiver,roundBox(3.02,.18,1.42),graphite,[0,-h+.09,0]);
  add(receiver,roundBox(2.85,.95,1.10),black,[0,-.08,-.06]);
  add(receiver,roundBox(2.74,.74,.075,.025),steel,[0,-.065,.495]);
  add(receiver,roundBox(2.51,.53,.058,.017),dark,[0,-.048,.549]);
  for(let i=0;i<9;i++){
    const x=(i-4)*.17;
    add(receiver,cylinder(.095,.07,6),brass,[x,-.02,.605],[half,0,0]);
    add(receiver,cylinder(.077,.105,24),graphite,[x,-.02,.662],[half,0,0]);
    add(receiver,cylinder(.053,.022,24),dark,[x,-.02,.725],[half,0,0]);
    add(receiver,cylinder(.033,.015,16),pin,[x,-.02,.740],[half,0,0]);
  }
  for(let j=0;j<38;j++) add(receiver,roundBox(.032,.155,.93,.008),graphite,[(j-18.5)*.069,.437,-.05]);
  for(const x of [-1.27,1.27]) for(const y of [-.35,.22]) {
    add(receiver,cylinder(.053,.016,20),brass,[x,y,.552],[half,0,0]);
    add(receiver,cylinder(.025,.007,6),dark,[x,y,.562],[half,0,0]);
  }
  batch(receiver);

  // Incoming power pair, with custom strain relief on the rear wall of the chassis.
  const leads=new T.Group();
  const jacket=metal(0x1a2321,.47,.18);
  for(let n=0;n<2;n++) {
    const x=-1.48+n*.32;
    const path=new T.CatmullRomCurve3([
      new T.Vector3(x,-.21,-1.17),new T.Vector3(x,-.21,-1.72),
      new T.Vector3(x-.58,-.58,-2.35),new T.Vector3(x-2.36,-.665,-2.5-n*.14),
      new T.Vector3(x-4.1,-.664,-3.72-n*.12),new T.Vector3(-11,-.66,-4.6-n*.09),
    ]);
    add(leads,new T.TubeGeometry(path,110,.052,10,false),jacket,[0,0,0]);
    add(leads,cylinder(.105,.34,36),graphite,[x,-.21,-1.29],[half,0,0]);
    for(let i=0;i<9;i++) add(leads,cylinder(.084-i*.0028,.034,24),jacket,[x,-.21,-1.46-i*.033],[half,0,0]);
  }
  batch(leads);stage.add(leads);
  return {stage, prism, receiver, pin};
}
