/** The orthographic camera is shared by the mist, raindrops, contact water and hit tests. */
const camera = { cosine: 0.908, sine: 0.419, pitch: 0.255, cut: 0.17, travel: 0.67 };
const stormHeight = 0.99;
const optics = `
const float C=.908, S=.419, PITCH=.255, CUT=.17, TRAVEL=.67, HEIGHT=.99;
uniform vec2 uViewport;
uniform float uScale, uSlice, uTime, uAnchor;
vec2 project(vec3 p) {
  float depth = -S*p.x+C*p.z;
  return vec2(uAnchor,.73)*uViewport+vec2(C*p.x+S*p.z, -p.y+PITCH*depth)*uScale;
}
`;
const quadVertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition*vec2(.5,-.5)+.5;
  gl_Position=vec4(aPosition,0.,1.);
}`;

// Integrate the length of the view ray inside each volume, keeping the gap transparent.
const waterFragment = `
precision highp float;
varying vec2 vUv;
${optics}
uniform vec4 uRings[6];
uniform sampler2D uPlate;
uniform vec2 uPhotoScale;
uniform float uHasPlate;
float rayLength(vec3 start, vec3 dir, vec3 lo, vec3 hi) {
  vec3 a=(lo-start)/dir, b=(hi-start)/dir;
  vec3 near=min(a,b), far=max(a,b);
  return max(0., min(far.x,min(far.y,far.z))-max(near.x,max(near.y,near.z)));
}
float outerHit(vec3 start, vec3 dir, vec3 lo, vec3 hi) {
  vec3 a=(lo-start)/dir, b=(hi-start)/dir;
  vec3 far=max(a,b);
  return min(far.x,min(far.y,far.z));
}
float hash21(vec2 p) { return fract(sin(dot(p,vec2(73.693,18.159)))*4375.583); }
float noise21(vec2 p) {
  vec2 cell=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash21(cell),hash21(cell+vec2(1,0)),f.x),
             mix(hash21(cell+vec2(0,1)),hash21(cell+1.),f.x),f.y);
}
float footprint(vec2 p, vec2 center, vec2 size) {
  vec2 q=abs(p-center)-size;
  return length(max(q,vec2(0)))+min(max(q.x,q.y),0.);
}
void main() {
  vec2 local = (vUv-vec2(uAnchor,.73))*uViewport/uScale;
  vec3 start=vec3(C*local.x,-local.y,S*local.x);
  vec3 dir=vec3(-S,PITCH,C);
  vec2 ground=(start+dir*(local.y/PITCH)).xz;
  float offset=uSlice*TRAVEL;
  float body=rayLength(start,dir,vec3(-.5,0,-.45),vec3(CUT,HEIGHT,.45));
  float piece=rayLength(start,dir,vec3(CUT+offset,0,-.45),vec3(.5+offset,HEIGHT,.45));
  float lengthInRain=body+piece;
  float edge=footprint(ground,vec2(.02+offset*.40,.025),vec2(.625+offset*.46,.58));
  if(lengthInRain<.0001 && edge>.42) discard;

  float noise=noise21(ground*12.);
  float wet=1.-smoothstep(-.16,.12,edge+(noise-.5)*.19);
  float caustic=noise21(ground*vec2(26.,45.)+vec2(uTime*.48,0.));
  float fall=1.-smoothstep(0.,.14,min(footprint(ground,vec2(-.165,0),vec2(.335,.45)),
                                     footprint(ground,vec2(.335+offset,0),vec2(.165,.45))));
  float rough=abs(fract((ground.y+.07*noise)*23.-uTime*.4)-.5);
  vec2 cells=ground*vec2(13.,13.);
  float rainPhase=fract(uTime*1.7+hash21(floor(cells)));
  float circle=abs(length(fract(cells)-.5)-rainPhase*.43);
  float patter=(1.-smoothstep(.025,.095,circle))*(1.-rainPhase)*fall;
  float glint=wet*(.04+.19*fall)*smoothstep(.42,.49,rough)*smoothstep(.46,.8,caustic);
  glint+=patter*.17+wet*.19*smoothstep(.68,.91,caustic)*smoothstep(.47,.65,noise);
  float ripple=0.;
  for(int i=0;i<6;i++) {
    float age=uTime-uRings[i].z;
    if(age>=0. && age<1.7) {
      float d=length(ground-uRings[i].xy);
      float wave=abs(d-age*.39);
      float crest=(1.-smoothstep(.006,.022,wave))+
                  .32*(1.-smoothstep(.006,.016,abs(d-age*.39+.038)));
      ripple+=crest*(1.-age/1.7)*uRings[i].w;
    }
  }

  vec3 photo=vec3(.65,.65,.61);
  float scatter=noise21(vec2(local.x*47.,local.y*6.-uTime*.8));
  vec3 slabLo=vec3(CUT+offset,0,-.45), slabHi=vec3(.5+offset,HEIGHT,.45);
  vec3 bulkLo=vec3(-.5,0,-.45), bulkHi=vec3(CUT,HEIGHT,.45);
  float exitBulk=outerHit(start,dir,bulkLo,bulkHi);
  float exitSlice=outerHit(start,dir,slabLo,slabHi);
  bool frontIsSlice=piece>.00001 && (body<.00001 || exitSlice>exitBulk);
  vec3 hit=start+dir*(frontIsSlice ? exitSlice:exitBulk);
  vec3 lo=frontIsSlice ? slabLo:bulkLo, hi=frontIsSlice ? slabHi:bulkHi;
  float top=1.-smoothstep(.0001,.0015,abs(hit.y-HEIGHT));
  float side=(1.-top)*(1.-smoothstep(.0001,.0015,abs(hit.x-lo.x)));
  float pattern=noise21(vec2((hit.x*.74+hit.z*.62)*26.,hit.y*2.3-uTime*.64));
  float stria=noise21(vec2((hit.x*.74+hit.z*.62)*178.,hit.y*8.-uTime));
  float current=pattern*.63+stria*.37;
  float topRing=noise21(hit.xz*vec2(68.,72.)+vec2(uTime*.3,-uTime*.7));
  vec2 uv=(vUv-vec2(.5,.73))*uPhotoScale+vec2(.5,.73);
  if(uHasPlate>.5 && lengthInRain>.001) {
    vec2 bend=(vec2(current-.5,pattern-.4)*.018+vec2(-.004,.002))*min(1.,lengthInRain*6.);
    photo=texture2D(uPlate,uv+bend).rgb;
  }
  // Cold skylight catches the cut faces at different angles. Path length
  // carries background detail through their thin edges and into silver mist.
  vec3 extinction=vec3(.105,.195,.205);
  vec3 fogColor=mix(extinction,vec3(.47,.57,.55),current*.73+side*.25);
  fogColor+=vec3(.29,.295,.26)*top;
  float droplets=smoothstep(.64,.9,stria)*(.16+.26*glint);
  vec3 cloud=mix(photo,fogColor,.78)+droplets+vec3(.12,.135,.11)*side;
  cloud+=top*(topRing-.48)*.31;
  float density=(1.-exp(-lengthInRain*2.9));
  float fog=density*(.86+.12*scatter);
  float outerRim=1.-smoothstep(.002,.019,min(min(abs(hit.z-.45),abs(hit.z+.45)),min(abs(hit.x-lo.x),abs(hit.x-hi.x))));
  float lip=top*outerRim*(.33+.32*stria);
  float seamDist=min(abs(hit.x-CUT),abs(hit.x-CUT-offset));
  float seam=(1.-smoothstep(.002,.012,seamDist))*(1.-side)*(.38+.5*current);
  cloud=mix(cloud,vec3(.89,.91,.84),clamp(lip+seam,0.,.7));
  float mist=exp(-abs(local.y)*12.)*.09*min(1.,lengthInRain*3.);
  float groundAlpha=wet*(.22+.28*fall);
  vec3 groundCol=vec3(.09,.13,.125)*groundAlpha+vec3(.85,.91,.87)*glint;
  float alpha=groundAlpha+glint;
  float vapor=clamp(fog+mist,0.,.94);
  vec3 color=mix(groundCol,cloud,vapor);
  alpha=mix(alpha,1.,vapor);
  float wave=clamp(ripple,0.,1.)*.68;
  color=mix(color,vec3(.86,.89,.85),wave);
  alpha=mix(alpha,1.,wave);
  if(alpha<.002) discard;
  gl_FragColor=vec4(color/max(.001,alpha),alpha);
}`;

const dropsVertex = `
precision highp float;
${optics}
attribute vec4 aDrop;
attribute vec2 aCorner;
uniform vec3 uHands[3];
varying vec4 vColor;
varying vec2 vCorner;
void main() {
  float k=aDrop.w;
  float phase=fract(aDrop.z-uTime*(.65+.57*k));
  float x=aDrop.x + step(CUT,aDrop.x)*uSlice*TRAVEL;
  float z=aDrop.y;
  vec3 pos=vec3(x,HEIGHT*phase,z);
  vec2 center=project(pos);
  vec2 shift=vec2(0);
  for(int i=0;i<3;i++) {
    vec2 delta=(center-uHands[i].xy)/uScale;
    float d=length(delta);
    shift+=delta/max(.025,d)*pow(max(0.,1.-d/.23),2.)*uHands[i].z*.095;
  }
  float lengthInWorld=.006+.033*k*k;
  float streakWidth=clamp(uScale*.00135,.36,.78);
  vec2 pixel=center+shift*uScale;
  pixel.x+=aCorner.x*streakWidth+aCorner.y*uScale*(lengthInWorld*.08+shift.x*.12);
  pixel.y+=aCorner.y*uScale*min(lengthInWorld,phase*HEIGHT);
  gl_Position=vec4(pixel/uViewport*vec2(2.,-2.)+vec2(-1.,1.),0,1);
  float front=clamp(.5+(-S*aDrop.x+C*z)*.72,0.,1.);
  float glimmer=pow(max(0.,sin(61.*k+z*74.+uTime*(2.+k*4.))),12.);
  float pale=smoothstep(.16,.68,k);
  vec3 tint=mix(vec3(.14,.22,.205),vec3(.80,.86,.83),pale);
  tint=mix(tint,vec3(1.,.995,.94),glimmer*.67);
  float fade=smoothstep(0.,.022,phase)*smoothstep(0.,.025,1.-phase);
  vColor=vec4(tint,fade*(.20+.27*front+.43*glimmer)*(.56+.44*pale));
  vCorner=aCorner;
}`;
const dropsFragment = `
precision mediump float;
varying vec4 vColor;
varying vec2 vCorner;
void main() {
  float taper=(1.-.46*abs(vCorner.x))*(1.-.65*vCorner.y);
  gl_FragColor=vec4(vColor.rgb,vColor.a*taper);
}`;

type Point = { x: number; y: number };
type Dimensions = { width: number; height: number; scale: number; anchor: number; dpr: number };
type Ripple = { x: number; z: number; born: number };
type Hand = Point & { strength: number };

function dimensions(canvas: HTMLCanvasElement): Dimensions {
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  const scale=Math.min(width*.49,height*.565);
  // Reserve enough room for the moving cut on a narrow touch screen.
  const anchor=Math.min(.55,.972-1.26*scale/width);
  return { width, height, scale, anchor, dpr: Math.min(1.65, devicePixelRatio || 1) };
}

function project(x: number, y: number, z: number, size: Dimensions): Point {
  const { cosine: c, sine: s, pitch } = camera;
  return { x: size.anchor * size.width + (c*x + s*z)*size.scale, y: .73 * size.height + ((-s*x + c*z)*pitch-y)*size.scale };
}

function groundAt(point: Point, size: Dimensions) {
  const { cosine: c, sine: s, pitch } = camera;
  const across = (point.x-size.width*size.anchor)/size.scale;
  const depth = (point.y-size.height*.73)/(size.scale*pitch);
  return { x: c*across-s*depth, z: s*across+c*depth };
}

function hitsSlice(point: Point, size: Dimensions, open: number) {
  const { cosine: c, sine: s, pitch, cut, travel } = camera;
  const across = (point.x-size.width*size.anchor)/size.scale, elevation = (.73*size.height-point.y)/size.scale;
  const margin = .045;
  const slabs = [
    [(c*across-(.5+travel*open+margin))/s, (c*across-(cut+travel*open-margin))/s],
    [(-.45-margin-s*across)/c, (.45+margin-s*across)/c],
    [(-margin-elevation)/pitch, (stormHeight+margin-elevation)/pitch],
  ];
  return Math.max(...slabs.map(p => p[0])) <= Math.min(...slabs.map(p => p[1]));
}

function seeds(count: number) {
  const drops = new Float32Array(count*4);
  let seed = 18103719;
  function rand() {
    seed = (Math.imul(1664525,seed)+1013904223)>>>0;
    return seed/4294967296;
  }
  for (let i = 0; i < drops.length; i+=4) {
    drops[i]=rand()-.5; drops[i+1]=(rand()-.5)*.9;
    drops[i+2]=rand(); drops[i+3]=rand();
  }
  return drops;
}

function compileProgram(gl: WebGLRenderingContext, vertex: string, fragment: string) {
  function shader(type: number, source: string) {
    const result = gl.createShader(type)!;
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result) || 'Shader compilation failed');
    return result;
  }
  const program = gl.createProgram()!;
  const vs=shader(gl.VERTEX_SHADER,vertex), fs=shader(gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'Program linking failed');
  return program;
}

type Frame = { size: Dimensions; open: number; time: number; hands: Hand[]; rings: Ripple[]; quality: number };
type Draw = (frame: Frame) => void;

function webGLRain(gl: WebGLRenderingContext, drops: Float32Array): Draw {
  const water = compileProgram(gl,quadVertex,waterFragment);
  const rain = compileProgram(gl,dropsVertex,dropsFragment);
  function makeBuffer(data: Float32Array) {
    const buffer=gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    return buffer;
  }
  const quad=makeBuffer(new Float32Array([-1,-1,1,-1,-1,1,1,1]));
  const corners = [-1,0,1,0,-1,1,-1,1,1,0,1,1];
  const vertices = new Float32Array(drops.length/4*6*6);
  for(let i=0;i<drops.length/4;i++) {
    for(let j=0;j<6;j++) {
      const k=(i*6+j)*6;
      vertices.set(drops.subarray(i*4,i*4+4),k);
      vertices[k+4]=corners[2*j]; vertices[k+5]=corners[2*j+1];
    }
  }
  const rainBuffer=makeBuffer(vertices);
  const quadLoc=gl.getAttribLocation(water,'aPosition');
  const dropsLoc=gl.getAttribLocation(rain,'aDrop'), cornerLoc=gl.getAttribLocation(rain,'aCorner');
  function uniforms(program: WebGLProgram, names: string[]) {
    return Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
  }
  const common=['uViewport','uScale','uTime','uSlice','uAnchor'];
  const wu=uniforms(water,[...common,'uRings[0]','uPlate','uPhotoScale','uHasPlate']);
  const ru=uniforms(rain,[...common,'uHands[0]']);
  const texture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([175,178,167]));
  const plate=document.querySelector<HTMLImageElement>('[data-quarry-plate]');
  let textureURL='', hasPhoto=false;
  const rings=new Float32Array(24), hands=new Float32Array(9);
  return ({ size, open, time, rings: recent, hands: active, quality })=>{
    if(plate?.complete && plate.naturalWidth && textureURL!==plate.currentSrc) {
      textureURL=plate.currentSrc;
      try {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,plate);
        hasPhoto=gl.getError()===gl.NO_ERROR;
      } catch { hasPhoto=false; }
    }
    gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    function commonValues(uniform: typeof wu) {
      gl.uniform2f(uniform.uViewport,size.width,size.height);
      gl.uniform1f(uniform.uAnchor,size.anchor); gl.uniform1f(uniform.uScale,size.scale); gl.uniform1f(uniform.uTime,time);
      gl.uniform1f(uniform.uSlice,open);
    }
    gl.useProgram(water); commonValues(wu);
    const aspect=size.width/size.height;
    const imageAspect=plate?.naturalWidth && plate?.naturalHeight ? plate.naturalWidth/plate.naturalHeight : aspect;
    gl.uniform2f(wu.uPhotoScale,Math.min(1,aspect/imageAspect),Math.min(1,imageAspect/aspect));
    gl.uniform1f(wu.uHasPlate,+hasPhoto); gl.uniform1i(wu.uPlate,0);
    rings.fill(0);
    recent.slice(-6).forEach((r,i)=>rings.set([r.x,r.z,r.born,1],i*4));
    gl.uniform4fv(wu['uRings[0]'],rings);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.enableVertexAttribArray(quadLoc); gl.vertexAttribPointer(quadLoc,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); gl.disableVertexAttribArray(quadLoc);
    gl.useProgram(rain); commonValues(ru);
    hands.fill(0); active.slice(-3).forEach((p,i)=>hands.set([p.x,p.y,p.strength],i*3));
    gl.uniform3fv(ru['uHands[0]'],hands);
    gl.bindBuffer(gl.ARRAY_BUFFER,rainBuffer);
    gl.enableVertexAttribArray(dropsLoc); gl.enableVertexAttribArray(cornerLoc);
    gl.vertexAttribPointer(dropsLoc,4,gl.FLOAT,false,24,0); gl.vertexAttribPointer(cornerLoc,2,gl.FLOAT,false,24,16);
    gl.drawArrays(gl.TRIANGLES,0,6*Math.floor(drops.length/4*quality));
    gl.disableVertexAttribArray(dropsLoc); gl.disableVertexAttribArray(cornerLoc);
  };
}

function canvasRain(ctx: CanvasRenderingContext2D, drops: Float32Array): Draw {
  return ({ size, time, open, rings, hands })=>{
    const { width, height, scale, dpr } = size;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
    function polygon(vertices: Point[], color: string) {
      ctx.fillStyle=color; ctx.beginPath();
      vertices.forEach((point,i)=>{ if(i===0) ctx.moveTo(point.x,point.y); else ctx.lineTo(point.x,point.y); });
      ctx.closePath(); ctx.fill();
    }
    function volume(left: number, right: number) {
      const p=(x: number,y: number,z: number)=>project(x,y,z,size);
      polygon([p(left,0,-.45),p(right,0,-.45),p(right,0,.45),p(left,0,.45)],'rgba(29,45,42,.24)');
      polygon([p(left,stormHeight,-.45),p(left,stormHeight,.45),p(left,0,.45),p(left,0,-.45)],'rgba(82,101,93,.17)');
      polygon([p(left,stormHeight,.45),p(right,stormHeight,.45),p(right,0,.45),p(left,0,.45)],'rgba(112,131,120,.17)');
      polygon([p(left,stormHeight,-.45),p(right,stormHeight,-.45),p(right,stormHeight,.45),p(left,stormHeight,.45)],'rgba(165,181,170,.12)');
    }
    volume(-.5,camera.cut); volume(camera.cut+camera.travel*open,.5+camera.travel*open);
    const count=Math.min(3600,drops.length/4);
    ctx.lineWidth=.75;
    // Group strokes by illumination so Canvas2D does not switch paint per droplet.
    for(let group=0;group<3;group++) {
      ctx.strokeStyle=['rgba(33,53,48,.32)','rgba(150,173,159,.45)','rgba(238,244,231,.62)'][group];
      ctx.beginPath();
      for(let i=group;i<count;i+=3) {
        const [x,z,initial,k]=drops.subarray(i*4,i*4+4);
        const phase=((initial-time*(.65+.57*k))%1+1)%1;
        const p=project(x+(x>=camera.cut?open*camera.travel:0),phase*stormHeight,z,size);
        for(const hand of hands) {
          const dx=(p.x-hand.x)/scale, dy=(p.y-hand.y)/scale, d=Math.hypot(dx,dy);
          if(d<.23 && d>.001) {
            const push=(1-d/.23)**2*hand.strength*.095*scale/d;
            p.x+=dx*push; p.y+=dy*push;
          }
        }
        const length=Math.min(phase,.009+.03*k*k)*scale;
        ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+length*.075,p.y+length);
      }
      ctx.stroke();
    }
    for(const r of rings) {
      const age=time-r.born;
      if(age<0 || age>1.7) continue;
      const p=project(r.x,0,r.z,size), radius=Math.max(.1,age*.39*scale);
      ctx.beginPath(); ctx.ellipse(p.x,p.y,radius,radius*camera.pitch,0,0,Math.PI*2);
      ctx.strokeStyle='rgba(245,248,232,'+(1-age/1.7)*.65+')'; ctx.stroke();
    }
  };
}

/** Wind, rain and a two-register bowed tone all originate locally. */
function rainAudio(button: HTMLButtonElement) {
  let context: AudioContext | undefined, master: GainNode | undefined;
  let filter: BiquadFilterNode | undefined, strings: GainNode | undefined;
  let enabled=false, position=0;
  function mix() {
    if(!context || !master || !filter || !strings) return;
    const now=context.currentTime;
    master.gain.setTargetAtTime(enabled && !document.hidden ? .13:0,now,.09);
    filter.frequency.setTargetAtTime(1300+position*1850,now,.09);
    strings.gain.setTargetAtTime(.010+position*.065,now,.12);
  }
  function build() {
    context=new AudioContext();
    master=context.createGain(); master.gain.value=0; master.connect(context.destination);
    const buffer=context.createBuffer(2,context.sampleRate*3,context.sampleRate);
    for(let ch=0;ch<2;ch++) {
      const data=buffer.getChannelData(ch);
      let slow=0;
      for(let i=0;i<data.length;i++) {
        const white=Math.random()*2-1;
        slow=(slow+.032*white)/1.032;
        data[i]=white*.46+slow*1.8;
      }
    }
    const noise=context.createBufferSource(); noise.buffer=buffer; noise.loop=true;
    filter=context.createBiquadFilter(); filter.type='lowpass'; filter.Q.value=.36;
    noise.connect(filter); filter.connect(master); noise.start();
    strings=context.createGain(); strings.gain.value=0; strings.connect(master);
    for(const hz of [98,146.8]) {
      const tone=context.createOscillator();
      tone.type='triangle'; tone.frequency.value=hz; tone.connect(strings); tone.start();
    }
  }
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',async ()=>{
    try {
      if(!context) build();
      enabled=!enabled;
      button.setAttribute('aria-pressed',String(enabled));
      button.dataset.sound=enabled?'on':'off';
      mix();
      if(enabled) await context!.resume();
    } catch {
      enabled=false; button.setAttribute('aria-pressed','false'); button.dataset.sound='off'; mix();
    }
  });
  document.addEventListener('visibilitychange',mix);
  return (open: number)=>{ position=open; mix(); };
}

export function initWeather(canvas: HTMLCanvasElement, range: HTMLInputElement, sound: HTMLButtonElement): void {
  const density = 14200;
  const drops=seeds(density), audio=rainAudio(sound);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let size=dimensions(canvas), open=0, time=7.89, lastFrame=0, tick=0, visible=true, quality=1;
  let slowFrames=0;
  const rings: Ripple[]=[], hands=new Map<number,Hand>();
  let grab: { id: number; start: Point; initial: number; moved: boolean } | null=null;
  let secondaryCanvas: HTMLCanvasElement | null=null, draw: Draw | undefined;
  let lastSplash=-10;
  canvas.style.touchAction='pan-y';
  const gl=canvas.getContext('webgl',{ alpha:true, antialias:false, depth:false, stencil:false, premultipliedAlpha:true, powerPreference:'low-power' });
  const lower=Number(range.min || 0), upper=Number(range.max || 100);
  let hoverTarget: number | null = null;
  let manual = false;
  function readRange() {
    open=Math.max(0,Math.min(1,(Number(range.value)-lower)/Math.max(.0001,upper-lower)));
    audio(open); renderSoon();
  }
  function setOpen(value: number) {
    range.value=String(lower+Math.max(0,Math.min(1,value))*(upper-lower));
    range.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function resize() {
    size=dimensions(canvas);
    const pixelWidth=Math.max(1,Math.round(size.width*size.dpr)), pixelHeight=Math.max(1,Math.round(size.height*size.dpr));
    for(const layer of [canvas,secondaryCanvas]) {
      if(!layer) continue;
      if(layer.width!==pixelWidth) layer.width=pixelWidth;
      if(layer.height!==pixelHeight) layer.height=pixelHeight;
    }
    renderSoon();
  }
  function software() {
    if(!secondaryCanvas) {
      const layer=document.createElement('canvas');
      layer.setAttribute('aria-hidden','true');
      layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      canvas.after(layer); secondaryCanvas=layer;
    }
    const ctx=secondaryCanvas.getContext('2d');
    if(ctx) draw=canvasRain(ctx,drops);
    canvas.dataset.renderer='2d'; resize();
  }
  function enableGL() {
    if(!gl) { software(); return; }
    try {
      draw=webGLRain(gl,drops);
      secondaryCanvas?.remove(); secondaryCanvas=null;
      canvas.dataset.renderer='webgl'; resize();
    } catch { software(); }
  }
  canvas.addEventListener('webglcontextlost',event=>{ event.preventDefault(); software(); });
  canvas.addEventListener('webglcontextrestored',enableGL);
  function render(now: number) {
    tick=0;
    if(!visible || document.hidden || !draw) { lastFrame=0; return; }
    const elapsed=lastFrame ? now-lastFrame : 16;
    lastFrame=now;
    if(motion.matches) {
      // Pair static rendering with static feedback when the user requests reduced motion.
      rings.splice(0);
    } else {
      time+=Math.min(.08,elapsed/1000);
      while(rings.length && time-rings[0].born>1.7) rings.shift();
      if(elapsed>34 && elapsed<200 && quality>.45) slowFrames++; else slowFrames=Math.max(0,slowFrames-1);
      if(slowFrames>10) { quality=Math.max(.45,quality*.82); slowFrames=0; }
    }
    if (hoverTarget !== null && !manual && !motion.matches) {
      open += (hoverTarget-open)*(1-Math.exp(-Math.min(elapsed,100)/140));
      range.value=String(open*100);
      audio(open);
    }
    canvas.setAttribute('aria-pressed',String(open>.5));
    draw({size,open,time,hands:[...hands.values()],rings,quality});
    if(!motion.matches) renderSoon();
  }
  function renderSoon() {
    if(!tick && visible && !document.hidden) tick=requestAnimationFrame(render);
  }
  function pointAt(event: PointerEvent): Point {
    const box=canvas.getBoundingClientRect();
    return { x:(event.clientX-box.left)*size.width/Math.max(1,box.width), y:(event.clientY-box.top)*size.height/Math.max(1,box.height) };
  }
  function ripple(point: Point, force=false) {
    const {x,z}=groundAt(point,size);
    if(Math.abs(x-.21-open*.2)>.99 || Math.abs(z)>.94 || (!force && time-lastSplash<.14)) return;
    rings.push({x,z,born:time}); if(rings.length>6) rings.shift();
    lastSplash=time; renderSoon();
  }
  function down(event: PointerEvent) {
    if(event.button!==0) return;
    const point=pointAt(event), onSlice=hitsSlice(point,size,open);
    manual=true; hoverTarget=null;
    hands.set(event.pointerId,{...point,strength:1});
    if(!grab && onSlice) {
      grab={id:event.pointerId,start:point,initial:open,moved:false};
      canvas.style.cursor='grabbing';
    } else { ripple(point,true); }
    canvas.setPointerCapture(event.pointerId);
    renderSoon();
  }
  function move(event: PointerEvent) {
    const point=pointAt(event);
    if(!manual && event.pointerType==='mouse' && !event.buttons) {
      const x=(point.x-size.anchor*size.width)/size.scale;
      const y=(point.y-size.height*.73)/size.scale;
      hoverTarget=Math.min(1,Math.max(0,(x+.52)*1.3))*Math.max(0,Math.min(1,2.5-Math.abs(y+.48)*2));
    }
    if(grab?.id===event.pointerId) {
      const dx=point.x-grab.start.x, dy=point.y-grab.start.y;
      grab.moved ||= Math.hypot(dx,dy)>4;
      if(grab.moved) {
        const tangentX=camera.cosine, tangentY=-camera.sine*camera.pitch;
        setOpen(grab.initial+(dx*tangentX+dy*tangentY)/((tangentX*tangentX+tangentY*tangentY)*size.scale*camera.travel));
      }
    } else {
      hands.set(event.pointerId,{...point,strength:event.buttons?1:.76});
      canvas.style.cursor=grab?'grabbing':hitsSlice(point,size,open)?'grab':'crosshair';
      if(event.buttons) ripple(point);
    }
    renderSoon();
  }
  function release(event: PointerEvent) {
    if(grab?.id===event.pointerId) {
      if(!grab.moved && event.type==='pointerup') setOpen(grab.initial>.5?0:1);
      grab=null;
      range.dispatchEvent(new Event('change',{bubbles:true}));
    }
    hands.delete(event.pointerId);
    canvas.style.cursor='crosshair'; renderSoon();
  }
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('pointerleave',event=>{ if(!canvas.hasPointerCapture(event.pointerId)) { hands.delete(event.pointerId); renderSoon(); } });
  canvas.addEventListener('keydown',event=>{
    if(![' ', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); manual=true; hoverTarget=null;
    setOpen(event.key==='ArrowLeft'?open-.1:event.key==='ArrowRight'?open+.1:open>.5?0:1);
  });
  range.addEventListener('input',()=>{manual=true; hoverTarget=null; readRange()}); range.addEventListener('change',readRange);
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(visible) { lastFrame=0; resize(); }
    else { hands.clear(); grab=null; }
  }).observe(canvas);
  document.addEventListener('visibilitychange',()=>{ lastFrame=0; if(!document.hidden) renderSoon(); });
  motion.addEventListener('change',renderSoon);
  document.querySelector('[data-quarry-plate]')?.addEventListener('load',renderSoon);
  enableGL(); readRange();
}
