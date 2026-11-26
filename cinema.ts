import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { animate } from 'animejs/animation';
import { createOpticFibres, fibrePoint, fibreTopology, type FibreQuality } from './optic-fibres';
import { makeBench } from './optical-bench';

const V = (x:number, y:number, z:number) => new T.Vector3(x,y,z);
const port = V(2.175,0,0);
const pointOnLoom = (t:number) => fibrePoint(t).add(port);
const clamp = T.MathUtils.clamp;
const mix = T.MathUtils.lerp;
const smooth = (p:number) => p*p*(3-2*p);
type Shot = { aim:T.Vector3; eye:T.Vector3; width:number };
const shot = (aim:T.Vector3, eye:T.Vector3, width:number):Shot => ({aim,eye:eye.normalize(),width});

// Each shot uses a different physical point on the same piece of optical equipment.
// Width is the framing in world units, independent of the device's field of view.
const sequence = [
  shot(V(.37,.06,-.16), V(4.25,3.15,5.65), 8.65),
  shot(V(.35,.09,-.06), V(-2.1,4.1,4.45), 5.65),
  shot(V(1.98,.02,-.14), V(4.2,2.0,3.4), 3.9),
  shot(pointOnLoom(.33), V(1.9,1.5,2.6), 4.8),
  shot(pointOnLoom(.49), V(1.6,1.3,1.9), 4.45),
  shot(pointOnLoom(.67).add(V(0,-.42,-.28)), V(2.2,1.9,4.8), 4.75),
  shot(pointOnLoom(.79), V(1.0,2.6,3.3), 6.3),
  shot(pointOnLoom(1).add(V(-.21,0,-.17)), V(3.8,3.2,4.3), 4.65),
];

function buildReflection(renderer:T.WebGLRenderer) {
  // A neutral stripbox across the lid, a tall cool card beside the chassis,
  // and a warm card behind the instrument. All reflection sources are geometry.
  const studio = new T.Scene();
  studio.background = new T.Color(.095,.117,.12);
  const box=new T.BoxGeometry(1,1,1);
  const cards:T.MeshBasicMaterial[]=[];
  function card(x:number,y:number,z:number,w:number,h:number,d:number,r:number,g:number,b:number){
    const m=new T.MeshBasicMaterial({color:new T.Color(r,g,b)});
    const panel=new T.Mesh(box,m);panel.position.set(x,y,z);panel.scale.set(w,h,d);studio.add(panel);cards.push(m);
  }
  card(-3,7,3,6,.1,3,4.4,4.0,3.3);
  card(5,1,-1,.1,5,2.2,2.1,3.6,3.7);
  card(-4,2,-4,.4,5.2,3.7,2.6,1.34,.51);
  card(0,0,6,7,1.6,.1,1.4,1.5,1.45);
  const generator=new T.PMREMGenerator(renderer);
  const reflection=generator.fromScene(studio,.025,.1,30,{size:128});
  generator.dispose();box.dispose();cards.forEach(m=>m.dispose());
  return reflection;
}

function lightRoom(world:T.Scene) {
  const key=new T.DirectionalLight(0xffdfb5,2.7);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-4.6,right:4.6,top:4.6,bottom:-4.6,near:.2,far:18});
  key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.00015;key.shadow.normalBias=.011;
  key.position.set(-3,6,3);world.add(key);
  const edge=new T.DirectionalLight(0xb9efed,1.95);
  edge.position.set(3,4,-4);world.add(edge);
  world.add(new T.HemisphereLight(0xb8d3ca,0x423421,.55));
  const practical=new T.PointLight(0xff9850,1.05,4,2);
  practical.position.copy(port).add(V(.38,.22,.29));
  world.add(practical);
  return practical;
}

function releaseScene(root:T.Object3D) {
  const materials = new Set<T.Material>();
  const geometries = new Set<T.BufferGeometry>();
  root.traverse(node=>{
    if (!(node instanceof T.Mesh || node instanceof T.Line || node instanceof T.Points)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material)?node.material:[node.material]) materials.add(material);
  });
  geometries.forEach(g=>g.dispose());
  materials.forEach(m=>m.dispose());
}

function machinedFinish(material:T.MeshStandardMaterial) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 localPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nlocalPoint=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 localPoint;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float along=localPoint.x*19.+localPoint.z*1300.+localPoint.y*1200.;
        float visible=1.-smoothstep(.4,3.4,fwidth(along));
        float brush=sin(along+sin(localPoint.x*21.)*.45)*visible;
        roughnessFactor=clamp(roughnessFactor+.042*brush,.09,.98);
      `);
  };
}
function qualityCeiling(renderer:T.WebGLRenderer):FibreQuality {
  const gl=renderer.getContext();
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  const adapter=info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software/i.test(adapter)) return 'low';
  return innerWidth<760 || matchMedia('(pointer: coarse)').matches ? 'balanced' : 'full';
}

export function mountCinema(reducedMotion = false) {
  const main = document.querySelector('main')!;
  const cues = [...main.querySelectorAll<HTMLElement>('[data-cue]')];
  if (!cues.length) return () => {};
  let renderer:T.WebGLRenderer;
  try {renderer=new T.WebGLRenderer({antialias:true, powerPreference:'high-performance'});}
  catch {return () => {};}
  const controller=new AbortController();
  const {signal}=controller;
  const canvas=renderer.domElement;
  canvas.className='live-stage';
  canvas.setAttribute('aria-hidden','true');
  document.body.prepend(canvas);
  const world=new T.Scene();
  world.background=new T.Color(0x0a1415);
  world.fog=new T.FogExp2(0x091215,.070);
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  const reflection=buildReflection(renderer);
  world.environment=reflection.texture;
  world.environmentIntensity=.83;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  const practical=lightRoom(world);
  const ceiling=qualityCeiling(renderer);
  let quality:FibreQuality=ceiling==='low' ? 'low' : 'balanced';
  const loom=createOpticFibres(quality);
  const bench=makeBench(pointOnLoom(.67),pointOnLoom(1),V(-.8,0,-.6));
  loom.group.position.copy(port);
  world.add(bench.stage,loom.group);
  const contactShadow=new T.Mesh(new T.PlaneGeometry(18,18),new T.ShadowMaterial({opacity:.50,depthWrite:false}));
  contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=-.699;contactShadow.receiveShadow=true;
  world.add(contactShadow);
  const camera=new T.PerspectiveCamera(33,1,.06,95);
  const subject=V(0,0,0), eye=V(0,0,0);
  const surfaces=[...document.querySelectorAll<HTMLButtonElement>('.instrument-surface')];
  if (!surfaces.length) {
    const target=document.createElement('button');
    target.type='button';target.className='instrument-surface';target.hidden=true;
    target.setAttribute('aria-label','Send an optical pulse. Drag or use the arrow keys to inspect.');
    surfaces.push(target);
  }
  const surface=surfaces[0];
  const surfaceParent=surface.parentNode;
  const surfaceNext=surface.nextSibling;
  document.body.append(surface);
  const action=document.querySelector<HTMLButtonElement>('.pulse-action');
  const coverButton=document.querySelector<HTMLButtonElement>('[data-cover]');
  const home=!!document.getElementById('identity');
  const controls=[surface,action,coverButton].filter((b):b is HTMLButtonElement=>!!b);
  const stops:number[]=[];
  let cameraShots:Shot[]=[];
  let anchors:number[]=[];
  let width=0,height=0,narrow=false;
  let alive=true, ready=false, requested=0, dirty=true;
  let lastTime=0, sinceAssessment=0, frameCount=0, slow=0, fast=0;
  let drawScale=1, qualityStep=quality==='low'?0:1, limited=false;
  const layers:FibreQuality[]=['low','balanced','high','full'];
  let previousLift=-1;
  let lastCue=-1, cover:T.Object3D|undefined, led:T.MeshStandardMaterial|undefined;
  let turn=0, tilt=0, orbit=0, elevation=0;
  let cursorX=0,cursorY=0, glideX=0,glideY=0;
  let dragId=-1,dragged=false,lastX=0,lastY=0;
  let opened=false;
  const mechanism={lift:0,packet:-1};
  let pulseAnimation:ReturnType<typeof animate>|undefined;
  let coverAnimation:ReturnType<typeof animate>|undefined;
  let stillReset=0;

  function reportDetail(){
    canvas.dataset.quality=quality;
    canvas.dataset.edges=String(loom.counts().edges);
    canvas.dataset.nodes=String(loom.counts().nodes);
    canvas.dataset.nativeEdges=String(fibreTopology.edges);
    canvas.dataset.nativeNodes=String(fibreTopology.nodes);
  }
  reportDetail();

  function schedule(){
    dirty=true;
    if (alive && ready && !requested && !document.hidden) requested=requestAnimationFrame(draw);
  }
  function setRatio(){
    renderer.setPixelRatio(Math.min(devicePixelRatio,ceiling==='low'?1:1.8)*drawScale);
    renderer.setSize(width,height,false);
  }
  function measure(){
    width=Math.max(1,document.documentElement.clientWidth);height=Math.max(1,innerHeight);
    narrow=width/height<1.03;
    camera.aspect=width/height;
    setRatio();
    const angles=sequence;
    cameraShots=cues.map((el,i)=>{
      if (home) return angles[Math.min(angles.length-1,i)];
      if (i===cues.length-1) return angles[7];
      if (!i) return angles[1];
      const t=.07 + .86*(i-1)/Math.max(1,cues.length-3);
      return shot(pointOnLoom(t),V(2.3+Math.cos(t*5),1.6+t,3.2),5.3);
    });
    stops.length=0;
    anchors=cues.map((el,i)=>{
      stops.push(i===0?0:el.getBoundingClientRect().top+scrollY-(parseFloat(getComputedStyle(el).scrollMarginTop)||0));
      if(narrow) return .50;
      return el.classList.contains('reverse') && !el.classList.contains('roster-intro') ? .30 : .715;
    });
    camera.updateProjectionMatrix();schedule();
  }

  function cue(){
    let i=0;
    while (i+1<stops.length && scrollY>=stops[i+1]) i++;
    const j=Math.min(i+1,stops.length-1);
    // A short dwell gives the visitor time to see a shot before the camera departs.
    const p=clamp((scrollY-stops[i])/Math.max(1,stops[j]-stops[i]),0,1);
    return {i,j,p:smooth(clamp((p-.09)/.84,0,1))};
  }
  function pulse(){
    if(!ready) return;
    pulseAnimation?.cancel();clearTimeout(stillReset);
    canvas.dataset.pulses=String(Number(canvas.dataset.pulses??0)+1);
    window.dispatchEvent(new Event('relay:pulse'));
    if(reducedMotion){
      mechanism.packet=.01;schedule();
      stillReset=window.setTimeout(()=>{mechanism.packet=-1;schedule();},380);
      return;
    }
    mechanism.packet=0;
    pulseAnimation=animate(mechanism,{packet:1.08,duration:2300,ease:'linear',onUpdate:schedule,onComplete:()=>{mechanism.packet=-1;schedule();}});
    schedule();
  }
  function toggleCover(){
    opened=!opened;
    coverButton?.setAttribute('aria-pressed',String(opened));
    canvas.dataset.cover=opened?'open':'closed';
    const label=coverButton?.querySelector('.cover-label');if(label)label.textContent=opened?'Lower cover':'Lift cover';
    coverAnimation?.cancel();
    if(reducedMotion){mechanism.lift=Number(opened);schedule();return;}
    coverAnimation=animate(mechanism,{lift:Number(opened),duration:opened?890:755,ease:'inOutCubic',onUpdate:schedule});
  }
  action?.addEventListener('click',pulse,{signal});
  coverButton?.addEventListener('click',toggleCover,{signal});
  surface.addEventListener('click',e=>{if(!dragged || e.detail===0)pulse();dragged=false;},{signal});
  surface.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='ArrowLeft'||event.key==='ArrowRight')turn+=event.key==='ArrowRight'?.21:-.21;
    else tilt=clamp(tilt+(event.key==='ArrowUp'?.1:-.1),-.28,.38);
    schedule();
  },{signal});
  surface.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary)return;
    lastX=event.clientX;lastY=event.clientY;dragged=false;
    dragId=event.pointerId;surface.setPointerCapture(dragId);
  },{signal});
  surface.addEventListener('pointermove',event=>{
    if(event.pointerId!==dragId)return;
    const dx=event.clientX-lastX,dy=event.clientY-lastY;
    if(!dragged&&Math.hypot(dx,dy)<5)return;
    dragged=true;turn+=dx*.009;tilt=clamp(tilt+dy*.0035,-.28,.38);
    lastX=event.clientX;lastY=event.clientY;schedule();
  },{signal});
  surface.addEventListener('lostpointercapture',()=>{dragId=-1;},{signal});
  window.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||reducedMotion)return;
    cursorX=event.clientX/width-.5;cursorY=event.clientY/height-.5;
  },{passive:true,signal});

  function assess(dt:number, close:boolean){
    if(ceiling==='low')return;
    sinceAssessment+=Math.min(dt,100);frameCount++;
    if(frameCount<48)return;
    const ms=sinceAssessment/frameCount;
    sinceAssessment=0;frameCount=0;
    slow=ms>26?slow+1:0;fast=ms<18.7?fast+1:0;
    let next=qualityStep;
    if(slow>=1){
      limited=true;
      if(next>0)next--;else if(drawScale>.82){drawScale=.82;setRatio();}
    } else if(fast>=2&&!limited&&next<layers.indexOf(ceiling)){
      // Native 1,024-span fibres are useful for macro inspection on fast GPUs.
      if(next<2||close)next++;
    } else if(next===3&&!close)next=2;
    if(next!==qualityStep){qualityStep=next;quality=layers[next];loom.setQuality(quality);reportDetail();fast=slow=0;}
  }
  function draw(now:number){
    requested=0;
    if(!alive||!ready||document.hidden||(!dirty&&reducedMotion))return;
    dirty=false;
    const dt=lastTime?now-lastTime:16.7;lastTime=now;
    const k=reducedMotion?1:1-Math.exp(-Math.min(dt,80)*.014);
    glideX=mix(glideX,cursorX,k);glideY=mix(glideY,cursorY,k);
    orbit=mix(orbit,turn,k);elevation=mix(elevation,tilt,k);
    const {i,j,p}=cue(),station=p<.5?i:j;
    const a=cameraShots[i],b=cameraShots[j];
    if(station!==lastCue){
      lastCue=station;canvas.dataset.cue=cues[station].id||'roster';
    }
    subject.lerpVectors(a.aim,b.aim,p);
    eye.lerpVectors(a.eye,b.eye,p).normalize();
    const theta=Math.atan2(eye.x,eye.z)+orbit+glideX*.055;
    const phi=clamp(Math.asin(eye.y)+elevation+glideY*.04,.15,1.32);
    const shotWidth=mix(narrow&&i===0&&home?6.65:a.width,narrow&&j===0&&home?6.65:b.width,p);
    const visibleHeight=narrow ? shotWidth / (width/height) * .78 : shotWidth/1.53;
    const distance=visibleHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov)*.5));
    camera.position.set(Math.sin(theta)*Math.cos(phi),Math.sin(phi),Math.cos(theta)*Math.cos(phi)).multiplyScalar(distance).add(subject);
    camera.lookAt(subject);
    const ax=mix(anchors[i],anchors[j],p);
    let ay=narrow?.342:.498;
    if(!narrow && !home && i>0)ay=.40;
    camera.projectionMatrix.elements[8]=1-2*ax;
    camera.projectionMatrix.elements[9]=2*ay-1;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const flash=mechanism.packet>=0?Math.exp(-Math.abs(mechanism.packet)*12):0;
    practical.intensity=.68+flash*8;
    if(led)led.emissiveIntensity=1.9+flash*5;
    if(cover && previousLift!==mechanism.lift){
      cover.position.y=.90*mechanism.lift;cover.rotation.z=.055*mechanism.lift;
      renderer.shadowMap.needsUpdate=true;previousLift=mechanism.lift;
    }
    bench.prism.rotation.y=.26+(reducedMotion?0:.10*Math.sin(now*.00032))+clamp(mechanism.packet,0,1)*.36;
    bench.pin.emissiveIntensity=.65+(mechanism.packet>0?2.5*Math.exp(-Math.abs(1-mechanism.packet)*14):0);
    loom.update(reducedMotion?0:now*.001,mechanism.packet);
    if(canvas.dataset.angle!==orbit.toFixed(2))canvas.dataset.angle=orbit.toFixed(2);
    canvas.dataset.cover=opened?'open':'closed';
    // Copy stays interactive in front. The hit region follows the lens target
    // throughout the journey and native vertical swiping continues to scroll.
    const hw=narrow?.80:.41, hh=narrow?.23:.37;
    surface.style.setProperty('--instrument-x',(ax*100).toFixed(2)+'%');
    surface.style.setProperty('--instrument-y',(ay*100).toFixed(2)+'%');
    surface.style.setProperty('--instrument-width',(hw*width).toFixed(0)+'px');
    surface.style.setProperty('--instrument-height',(hh*height).toFixed(0)+'px');
    renderer.render(world,camera);
    if(!reducedMotion){assess(dt,shotWidth<5.25);requested=requestAnimationFrame(draw);}
  }
  const resize=new ResizeObserver(measure);
  resize.observe(main);
  window.addEventListener('resize',measure,{passive:true,signal});
  window.addEventListener('scroll',schedule,{passive:true,signal});
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden){cancelAnimationFrame(requested);requested=0;}
    else {lastTime=0;schedule();}
  },{signal});
  function cleanup(){
    if(!alive)return;
    alive=false;controller.abort();resize.disconnect();cancelAnimationFrame(requested);
    clearTimeout(stillReset);pulseAnimation?.cancel();coverAnimation?.cancel();
    controls.forEach(el=>el.hidden=true);
    document.body.classList.remove('room-rendered');
    if(surfaceParent)surfaceParent.insertBefore(surface,surfaceNext);else surface.remove();
    loom.dispose();releaseScene(world);reflection.dispose();
    renderer.dispose();canvas.remove();
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cleanup();},{signal});
  measure();
  new GLTFLoader().load('/models/relay.glb',({scene:model})=>{
    if(!alive){releaseScene(model);return;}
    cover=model.getObjectByName('ServiceCover');
    model.traverse(node=>{
      if(!(node instanceof T.Mesh))return;
      const m=node.material as T.MeshStandardMaterial;
      node.castShadow=!m.transparent;node.receiveShadow=!m.transparent;
      if(m.name==='Fibre emission')led=m;
      if (/aluminium|Pewter|Manganese|soldermask/.test(m.name)) machinedFinish(m);
      if(m.name==='Neutral smoked cover'){m.depthWrite=false;node.renderOrder=2;}
    });
    world.add(model);
    ready=true;canvas.dataset.ready='';document.body.classList.add('room-rendered');
    controls.forEach(el=>el.hidden=false);coverButton?.setAttribute('aria-pressed','false');
    schedule();
  },undefined,cleanup);
  return cleanup;
}
