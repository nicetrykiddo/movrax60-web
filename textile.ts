import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const clamp=THREE.MathUtils.clamp, lerp=THREE.MathUtils.lerp;
const smooth=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);

// Fade thread frequencies past the pixel sampling limit as the lens moves.
function shadeSilk(material:THREE.MeshStandardMaterial,woven:boolean,clock:{value:number}) {
  material.side=THREE.DoubleSide;
  material.onBeforeCompile=shader=>{
    shader.uniforms.loomTime=clock;
    shader.vertexShader='uniform float loomTime; varying vec2 loomUV;\n'+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\nloomUV = uv;')
      .replace('#include <morphtarget_vertex>',`#include <morphtarget_vertex>
        float freedom=.22+.19*clamp(3.65-position.y,0.,3.8);
        transformed.z+=freedom*(.052*sin(position.x*2.25+position.y*.81+loomTime*.72)+.015*sin(position.y*3.1-position.x+loomTime*.95));
        transformed.y+=freedom*.021*sin(position.x*1.9+loomTime*.8);`);
    shader.fragmentShader='varying vec2 loomUV;\n'+shader.fragmentShader;
    if(woven)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 yarn=loomUV*vec2(484.,381.), footprint=fwidth(yarn);
      vec2 clarity=1.-smoothstep(vec2(.22),vec2(.84),footprint);
      vec2 thread=cos(6.28318*yarn);
      float twill=cos(6.28318*(yarn.x-yarn.y)/3.)*(1.-smoothstep(.4,1.8,max(footprint.x,footprint.y)));
      diffuseColor.rgb*=1.+.205*thread.x*clarity.x+.15*thread.y*clarity.y+.11*twill;
      diffuseColor.rgb*=1.+.033*cos(6.28318*(loomUV.x*86.+.18*sin(loomUV.y*13.)));`);
  };
  material.customProgramCacheKey=()=>woven?'twill':'yarn';
  material.defines={...material.defines,USE_UV:''};
}

export function mountTextile(){
  const surface=document.createElement('div');
  surface.className='loom';surface.setAttribute('aria-hidden','true');
  const home=document.querySelector<HTMLElement>('.hero-track'), archive=document.getElementById('results'),
    crew=document.getElementById('team'), contact=document.getElementById('contact');
  const grab=document.querySelector<HTMLButtonElement>('.grab'), control=document.querySelector<HTMLButtonElement>('.fold');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'), owner=new AbortController(), {signal}=owner;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}
  catch{return ()=>{};}
  document.body.prepend(surface);surface.append(renderer.domElement);
  renderer.setClearColor(0x18101b,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,1,.1,65), clock={value:0};
  const key=new THREE.DirectionalLight(0xffd2aa,3.0);
  key.position.set(-3.4,5.5,4.1);
  const rim=new THREE.DirectionalLight(0xffa363,2.4);
  rim.position.set(5.1,4,-3.3);
  const bounce=new THREE.DirectionalLight(0xb4a7e2,1.05);
  bounce.position.set(4,1,3.1);
  scene.add(key,rim,bounce,new THREE.HemisphereLight(0xf1c2a7,0x29172c,1.04));
  const cloth=new THREE.Group();scene.add(cloth);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(12,6),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v;void main(){vec2 p=(v-.5)*vec2(3.8,4.8);gl_FragColor=vec4(.025,.009,.023,.62*exp(-dot(p,p)*2.));}'
  }));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(1.62,-.50,.05);scene.add(shadow);
  const dustGeo=new THREE.BufferGeometry(), motes=new Float32Array(52*3);
  for(let i=0;i<52;i++){
    const n=(k:number)=>THREE.MathUtils.euclideanModulo(Math.sin(i*71.13+k*17.83)*43758.55,1);
    motes.set([n(1)*11-5,n(2)*6-1.5,n(3)*3.2+.2],i*3);
  }
  dustGeo.setAttribute('position',new THREE.BufferAttribute(motes,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xffbd85,size:.012,opacity:.43,transparent:true,depthWrite:false}));
  scene.add(dust);
  const meshes:THREE.Mesh[]=[], morphs:THREE.Mesh[]=[];
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
  let ready=false,disposed=false,frame=0,last=0,lift=0,desired=0,drawn=0,drawTarget=0;
  let yaw=0,pointer=0,scale=1,width=0,height=0,top=0,shelfStart=Infinity,crewStart=Infinity,contactStart=Infinity;
  let drag:{x:number;y:number;id:number;start:number;horizontal:boolean}|null=null;
  let suppressClick=false;
  function pose(value:boolean){
    desired=value?1:0;
    for(const button of [grab,control])button?.setAttribute('aria-pressed',String(value));
    const label=control?.querySelector('span');
    if(label)label.textContent=value?'Lower the fold':'Pick up the fold';
    invalidate();
  }
  function quality(){
    renderer.setPixelRatio(Math.min(devicePixelRatio,scale*(width<730?1.65:1.55)));
    renderer.setSize(width,height,false);
  }
  function measure(){
    width=surface.clientWidth;height=surface.clientHeight;
    shelfStart=archive?archive.offsetTop:Infinity;crewStart=crew?crew.offsetTop:Infinity;contactStart=contact?contact.offsetTop:Infinity;
    camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();quality();scroll();
  }
  function scroll(){
    top=window.scrollY;
    const pull=home?clamp(top/Math.max(1,shelfStart-height*.48),0,1):0;
    home?.style.setProperty('--travel',pull.toFixed(4));invalidate();
  }
  function invalidate(){
    if(!frame&&!disposed&&!document.hidden&&ready)frame=requestAnimationFrame(render);
  }
  let slow=0;
  function render(now:number){
    frame=0;
    if(disposed||document.hidden||!ready)return;
    const elapsed=last?now-last:16,dt=Math.min(elapsed/1000,.05);
    last=now;
    const phone=width<730,ratio=width/height;
    if(home && top>=shelfStart && top+height<=crewStart){last=0;return;}
    if(!reduce.matches)clock.value+=dt;
    const damp=reduce.matches?1:1-Math.exp(-dt*10.5);
    lift=lerp(lift,desired,damp);drawn=lerp(drawn,drawTarget,damp);yaw=lerp(yaw,pointer,damp);
    for(const mesh of morphs){
      const map=mesh.morphTargetDictionary!,weights=mesh.morphTargetInfluences!;
      weights[map.Lift]=lift;weights[map.Draw]=drawn;
    }
    const p=home&&!reduce.matches?smooth(0,shelfStart-height*.22,top):0;
    const lower=home?smooth(crewStart-height,crewStart,top):1;
    const exit=smooth(contactStart-height,contactStart+height*.15,top);
    camera.fov=phone?40:35;
    const span=phone?Math.max(6.45,4.55/Math.max(.35,ratio)):Math.max(6.6,10.7/ratio);
    const introX=phone?1.9:.11;
    let targetX=introX+p*.95,targetY=phone?-.11:1.56;
    let posX=introX+yaw*.105+p*1.5,posY=(phone?1.10:2.44)+p*.33,posZ=span-p*2.9;
    if(lower>0){
      const nearX=phone?3.7:3.35;
      targetX=lerp(targetX,nearX+exit*.22,lower);targetY=lerp(targetY,1.62-exit*.43,lower);
      posX=lerp(posX,nearX+2.65+exit,lower);posY=lerp(posY,2.0+exit,lower);posZ=lerp(posZ,5.0-exit*.73,lower);
    }
    camera.position.set(posX,posY,posZ);camera.lookAt(targetX,targetY,0);camera.updateProjectionMatrix();
    dust.rotation.y=.014*Math.sin(clock.value*.16);dust.position.y=.07*Math.sin(clock.value*.21);
    renderer.render(scene,camera);
    if(elapsed>27&&elapsed<120)slow++;else slow=Math.max(0,slow-1);
    if(slow>30&&scale>.74){scale=Math.max(.74,scale-.13);quality();slow=0;}
    if(!reduce.matches)invalidate();else last=0;
  }
  function activate(value:boolean){
    ready=value;surface.toggleAttribute('data-ready',value);document.body.classList.toggle('has-silk',value);
    if(grab)grab.hidden=!value;if(control)control.hidden=!value;
  }
  function releaseResources(root:THREE.Object3D){
    const materials=new Set<THREE.Material>();
    root.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Points){
      obj.geometry.dispose();(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(mat=>materials.add(mat));
    }});materials.forEach(mat=>mat.dispose());
  }
  new GLTFLoader().load('/models/standard.glb',gltf=>{
    if(disposed){releaseResources(gltf.scene);return;}
    cloth.add(gltf.scene);
    gltf.scene.traverse(obj=>{
      if(!(obj instanceof THREE.Mesh))return;
      meshes.push(obj);shadeSilk(obj.material,!!obj.geometry.attributes.uv,clock);
      if(obj.morphTargetDictionary?.Lift!==undefined)morphs.push(obj);
    });
    activate(true);measure();
  },undefined,()=>activate(false));
  grab?.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    ndc.set(e.clientX/width*2-1,1-e.clientY/height*2);ray.setFromCamera(ndc,camera);
    const hit=ray.intersectObjects(meshes,false)[0];
    drag={x:e.clientX,y:e.clientY,id:e.pointerId,start:desired,horizontal:false};
    drawTarget=hit?.23:.1;suppressClick=false;invalidate();
  },{signal});
  grab?.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.horizontal && Math.abs(dx)>7 && Math.abs(dx)>Math.abs(dy)){
      drag.horizontal=true;grab.setPointerCapture(e.pointerId);
    }
    if(drag.horizontal){desired=clamp(drag.start+dx/Math.min(155,width*.28),0,1);drawTarget=clamp(Math.abs(dx)/120,0,1);invalidate();}
  },{signal});
  function release(e:PointerEvent){
    if(!drag||drag.id!==e.pointerId)return;
    suppressClick=drag.horizontal;
    if(e.type==='pointercancel')pose(drag.start>.5);else if(drag.horizontal)pose(desired>=.5);
    drag=null;drawTarget=0;invalidate();
  }
  window.addEventListener('pointerup',release,{signal});window.addEventListener('pointercancel',release,{signal});
  grab?.addEventListener('click',()=>{if(!suppressClick)pose(desired<.5);suppressClick=false;},{signal});
  control?.addEventListener('click',()=>pose(desired<.5),{signal});
  window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!reduce.matches)pointer=e.clientX/width*2-1;},{signal});
  window.addEventListener('scroll',scroll,{passive:true,signal});
  const resize=new ResizeObserver(measure);resize.observe(surface);if(home)resize.observe(home);
  const main=document.querySelector('main');if(main)resize.observe(main);
  reduce.addEventListener('change',invalidate,{signal});
  document.addEventListener('visibilitychange',()=>{last=0;invalidate();},{signal});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();activate(false);},{signal});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{activate(meshes.length>0);measure();},{signal});
  return ()=>{disposed=true;owner.abort();cancelAnimationFrame(frame);resize.disconnect();activate(false);releaseResources(scene);renderer.dispose();surface.remove();};
}
