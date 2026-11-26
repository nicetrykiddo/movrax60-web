import { animate } from 'animejs/animation';

export function attachInterface() {
  const owner = new AbortController();
  const { signal } = owner;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let dispose: (() => void) | undefined;
  void import('./cinema').then(({mountCinema})=>{
    if(signal.aborted)return;
    function mount(){dispose?.();dispose=mountCinema(motion.matches);}
    mount();
    motion.addEventListener('change',mount,{signal});
  });
  const observer = new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      if(!motion.matches)animate(entry.target,{opacity:[.64,1],y:[9,0],duration:430,ease:'outCubic'});
      observer.unobserve(entry.target);
    }
  });
  document.querySelectorAll('.scene-copy').forEach(el=>observer.observe(el));
  window.addEventListener('relay:pulse',()=>{
    const status=document.querySelector('#pulse-status');
    if(status)status.textContent='Pulse transmitted';
    const glyph=document.querySelector('.pulse-glyph');
    if(glyph&&!motion.matches)animate(glyph,{scale:[1,1.6,1],duration:540});
  },{signal});
const results = document.querySelector<HTMLElement>('.result-dial');
if (results) {
  const controls = [...results.querySelectorAll<HTMLAnchorElement>('a')];
  const sections = controls.map(
    (link) => document.getElementById(link.hash.slice(1))!,
  );
  const caption = results.querySelector('span')!;
  const first = sections[0];
  const last = sections.at(-1)!;
  function track() {
    results!.hidden =
      first.getBoundingClientRect().top > innerHeight * 0.72 ||
      last.getBoundingClientRect().bottom < innerHeight * 0.2;
    if (results!.hidden) return;
    let active = 0;
    sections.forEach((section, i) => {
      if (section.getBoundingClientRect().top < innerHeight * 0.46) active = i;
    });
    controls.forEach((link, i) => {
      if (i === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  controls.forEach((link) => {
    const label = link.getAttribute('aria-label')!;
    const show = () => {
      caption.textContent = label;
      results.dataset.preview = '';
    };
    const hide = () => delete results.dataset.preview;
    link.addEventListener('pointerenter', show, {signal});
    link.addEventListener('focus', show, {signal});
    link.addEventListener('pointerleave', hide, {signal});
    link.addEventListener('blur', hide, {signal});
    link.addEventListener('click', hide, {signal});
  });
  addEventListener('scroll', track, { passive: true, signal });
  addEventListener('resize', track, { passive: true, signal });
  track();
}

const articles = [...document.querySelectorAll<HTMLElement>('.player')];
const plates = [
  ...document.querySelectorAll<HTMLAnchorElement>('.player-plate'),
];
const directory = document.querySelector<HTMLElement>('.member-stage');
const index = [
  ...document.querySelectorAll<HTMLAnchorElement>('.player-index a'),
];
if (directory && plates.length) {
  const previous = directory.querySelector<HTMLButtonElement>(
    '.plate-step.previous',
  )!;
  const next = directory.querySelector<HTMLButtonElement>('.plate-step.next')!;
  previous.hidden = next.hidden = false;
  let selected = 0;
  let scheduled = 0;
  function select(active: number) {
    selected = active;
    previous.disabled = active === 0;
    next.disabled = active === plates.length - 1;
    plates.forEach((plate, i) => {
      const offset = i - active;
      plate.style.setProperty('--offset', String(offset));
      plate.style.setProperty('--distance', String(Math.abs(offset)));
      plate.style.setProperty('--deck-order', String(20 - Math.abs(offset)));
      if (i === active) plate.setAttribute('aria-current', 'location');
      else plate.removeAttribute('aria-current');
      if (i === active) index[i]?.setAttribute('aria-current', 'location');
      else index[i]?.removeAttribute('aria-current');
    });
  }
  function follow() {
    scheduled = 0;
    const line = innerHeight * 0.56;
    let active = 0;
    articles.forEach((item, i) => {
      if (item.getBoundingClientRect().top <= line) active = i;
    });
    if (active !== selected) select(active);
  }
  select(0);
  follow();
  addEventListener(
    'scroll',
    () => {
      if (!scheduled) scheduled = requestAnimationFrame(follow);
    },
    { passive: true, signal },
  );
  addEventListener('resize', follow, { passive: true, signal });
  function step(direction: number, moveFocus: boolean) {
    const target = Math.min(
      plates.length - 1,
      Math.max(0, selected + direction),
    );
    const control = index[target] ?? plates[target];
    select(target);
    if (moveFocus) control.focus({ preventScroll: true });
    control.click();
  }
  previous.addEventListener('click', () => step(-1, false), {signal});
  next.addEventListener('click', () => step(1, false), {signal});
  directory.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1, true);
  }, {signal});
}

const soundButton = document.querySelector<HTMLButtonElement>('.sound');
let audio: HTMLAudioElement | undefined;
let enabled = false;
let audioRequest = 0;
function showSound() {
  if (!soundButton) return;
  const text = enabled ? 'Sound on' : 'Sound off';
  soundButton.setAttribute('aria-label', text);
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.querySelector('span')!.textContent = text;
}
async function playSound() {
  const request = ++audioRequest;
  if (!audio || !enabled || document.hidden) {
    audio?.pause();
    return;
  }
  try {
    await audio.play();
  } catch {
    if (request === audioRequest) {
      enabled = false;
      showSound();
    }
  }
}
if (soundButton) {
  soundButton.hidden = false;
  soundButton.addEventListener('click', () => {
    if (!audio) {
      audio = new Audio('/audio/ambient.mp3');
      audio.loop = true;
      audio.volume = 0.28;
    }
    enabled = !enabled;
    showSound();
    void playSound();
  }, {signal});
  document.addEventListener('visibilitychange', () => void playSound(), {signal});
}

  return ()=>{ owner.abort(); observer.disconnect(); dispose?.(); enabled=false; audio?.pause(); };
}
