import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

const studio = document.querySelector<HTMLElement>('.studio')!;
const story = document.querySelector<HTMLElement>('.story')!;
const canvas = studio.querySelector('canvas')!;
const context = canvas.getContext('2d');
const frameCount = 64;
const media = gsap.matchMedia();

media.add('(prefers-reduced-motion: no-preference)', () => {
  if (!context) return;
  const scroller = new Lenis({ anchors: true, smoothWheel: true, syncTouch: false });
  scroller.on('scroll', ScrollTrigger.update);

  const cache = new Map<number, HTMLImageElement>();
  const failed = new Set<number>();
  let active = true;
  let visible = true;
  let painted = -1;
  let position = 0;
  let velocity = 0;
  let destination = 0;
  let pointerOffset = 0;
  let previousTime = 0;

  function fetchFrame(index: number) {
    if (index < 0 || index >= frameCount || cache.has(index) || failed.has(index)) return;
    const image = new Image();
    cache.set(index, image);
    image.decoding = 'async';
    image.onerror = () => { failed.add(index); cache.delete(index); };
    image.src = '/turn/' + String(index).padStart(2, '0') + '.webp';
  }

  function paint() {
    const index = Math.min(frameCount-1, Math.max(0, Math.round(position)));
    const direction = velocity < 0 ? -1 : 1;
    for (const offset of [0, 1, 2, -1]) fetchFrame(index + direction*offset);
    const image = cache.get(index);
    if (index === painted || !image?.complete || !image.naturalWidth) return;
    context!.clearRect(0, 0, canvas.width, canvas.height);
    context!.drawImage(image, 0, 0, canvas.width, canvas.height);
    studio.classList.add('rendered');
    painted = index;
    canvas.dataset.frame = String(index);
    // Keep decoded RGBA frames bounded even after several complete traversals.
    for (const key of cache.keys()) if (Math.abs(key-index) > 6) cache.delete(key);
  }

  const cameraTravel = ScrollTrigger.create({
    trigger: story, start: 'top top', end: () => 'bottom ' + (matchMedia('(max-width:700px)').matches ? '85%' : 'bottom'),
    onUpdate: self => { if (!matchMedia('(max-width:700px)').matches) destination = self.progress*(frameCount-1); }
  });
  // On a phone the sculpture leaves the viewport with the opening section.
  const phoneTravel = ScrollTrigger.create({
    trigger: '.opening', start: 'top top', end: 'bottom top',
    onUpdate: self => { if (matchMedia('(max-width:700px)').matches) destination = self.progress*(frameCount-1); }
  });

  function point(event: PointerEvent) {
    if (event.pointerType === 'mouse') pointerOffset = (event.clientX/innerWidth-.5)*5;
  }
  function resetPoint() { pointerOffset = 0; }
  story.addEventListener('pointermove', point);
  story.addEventListener('pointerleave', resetPoint);
  const observer = new IntersectionObserver(([entry]) => { visible=entry.isIntersecting; });
  observer.observe(studio);

  function tick(time: number) {
    scroller.raf(time*1000);
    const dt = Math.min(1/30, Math.max(0, time-previousTime));
    previousTime=time;
    if (!active || !visible || document.hidden) return;
    const target = gsap.utils.clamp(0, frameCount-1, destination+pointerOffset);
    // Integrate a damped torsional spring in small timesteps for wheel and touch alike.
    const step = dt/4;
    for (let i=0; i<4; i++) {
      velocity += ((target-position)*155 - velocity*21)*step;
      position += velocity*step;
    }
    paint();
  }
  gsap.ticker.add(tick);
  gsap.from('.result-line strong', {y:18, scrollTrigger:{trigger:'#results',start:'top 90%',end:'top 35%',scrub:true}});
  return () => {
    active=false;
    gsap.ticker.remove(tick);
    observer.disconnect();
    cameraTravel.kill();
    phoneTravel.kill();
    story.removeEventListener('pointermove',point);
    story.removeEventListener('pointerleave',resetPoint);
    scroller.destroy();
    cache.clear();
    studio.classList.remove('rendered');
    context.clearRect(0,0,canvas.width,canvas.height);
    delete canvas.dataset.frame;
  };
});
