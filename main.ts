import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { mountCinema } from './cinema';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const frameCount = 120;
const wrapFrame = (value: number) =>
  ((Math.round(value) % frameCount) + frameCount) % frameCount;
const stillURL = (frame: number) =>
  `/pin/${String(frame).padStart(3, '0')}.webp`;

function mountPin(
  runway: HTMLElement,
  pin: HTMLImageElement,
  control: HTMLButtonElement,
) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.width = canvas.height = 960;
  canvas.setAttribute('aria-hidden', 'true');
  pin.after(canvas);
  pin.dataset.frame = '0';

  const hit = document.createElement('div');
  hit.className = 'pin-hit';
  hit.setAttribute('aria-hidden', 'true');
  control.before(hit);
  control.hidden = false;

  const cache = new Map<number, HTMLImageElement>();
  const pending = new Set<number>();
  const failures = new Set<number>();
  const atlas = new Image();
  let position = 0;
  let target = 0;
  let manual = 0;
  let scrollAngle = 0;
  let direction = 1;
  let scrollProgress = 0;
  let currentPaint = '';
  let frameRequest = 0;
  let flip: { start: number; from: number } | undefined;
  let pointer:
    | { id: number; x: number; start: number; moved: boolean }
    | undefined;
  const compact = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');

  function loadFrame(frame: number) {
    if (cache.has(frame) || pending.has(frame) || failures.has(frame)) return;
    const image = new Image();
    pending.add(frame);
    image.decoding = 'async';
    image.src = stillURL(frame);
    image
      .decode()
      .then(() => {
        cache.set(frame, image);
        if (cache.size > 16) cache.delete(cache.keys().next().value!);
        render();
      })
      .catch(() => failures.add(frame))
      .finally(() => pending.delete(frame));
  }

  function render() {
    const exact = wrapFrame(position);
    const still = cache.get(exact);
    const preview = exact;
    const painted = still ? exact : preview;
    const useAtlas = Boolean(!still && atlas.complete && atlas.naturalWidth);
    if (!still && !useAtlas) return;
    const key = `${painted}/${useAtlas}`;
    if (key === currentPaint) return;
    currentPaint = key;
    context!.clearRect(0, 0, canvas.width, canvas.height);
    if (still) {
      context!.drawImage(still, 0, 0);
    } else {
      const tile = 288;
      const index = preview;
      context!.drawImage(
        atlas,
        (index % 12) * tile,
        Math.floor(index / 12) * tile,
        tile,
        tile,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }
    runway.classList.add('pin-ready');
    pin.dataset.frame = String(painted);
  }

  function tick(now: number) {
    frameRequest = 0;
    const diff = target - position;
    if (flip && !reduced.matches) {
      const t = Math.min(1, (now - flip.start) / 850);
      const turn = t * t * (3 - 2 * t);
      position = flip.from + (target - flip.from) * turn;
      if (t === 1) flip = undefined;
    } else if (Math.abs(diff) < 0.45 || reduced.matches) {
      position = target;
    } else {
      position += diff * 0.16;
    }
    render();
    if (position === target) loadFrame(wrapFrame(target));
    else if (!atlas.complete && !reduced.matches && pending.size < 2) {
      loadFrame(wrapFrame(position + direction * 2));
    }
    if (position !== target) frameRequest = requestAnimationFrame(tick);
  }

  function turn(value: number) {
    target = value;
    direction = target >= position ? 1 : -1;
    if (!reduced.matches && !atlas.src) {
      atlas.src = '/pin/orbit.webp';
    }
    if (!frameRequest) frameRequest = requestAnimationFrame(tick);
  }

  atlas.addEventListener('load', render);
  if (!reduced.matches)
    pin
      .decode()
      .then(() => {
        if (!atlas.src) atlas.src = '/pin/orbit.webp';
      })
      .catch(() => {});
  control.addEventListener('click', () => {
    if (!reduced.matches) flip = { start: performance.now(), from: position };
    manual += frameCount / 2;
    turn(manual + scrollAngle);
  });
  hit.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    flip = undefined;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      start: manual,
      moved: false,
    };
    hit.setPointerCapture(event.pointerId);
  });
  hit.addEventListener('pointermove', (event) => {
    if (pointer?.id !== event.pointerId) return;
    const distance = event.clientX - pointer.x;
    if (!pointer.moved && Math.abs(distance) < 5) return;
    pointer.moved = true;
    manual = pointer.start + distance * 0.44;
    turn(manual + scrollAngle);
  });
  hit.addEventListener('pointerup', (event) => {
    if (pointer?.id !== event.pointerId) return;
    if (!pointer.moved) control.click();
    pointer = undefined;
  });
  hit.addEventListener('lostpointercapture', () => {
    pointer = undefined;
  });
  hit.addEventListener('pointercancel', () => {
    pointer = undefined;
  });

  function applyLayout(progress: number) {
    const mobile = compact.matches;
    const t = gsap.parseEase('power2.inOut')(Math.min(1, progress / 0.87));
    runway.style.setProperty(
      '--pin-x',
      `${mobile ? 58 - 4 * t : 72 - 4.5 * t}%`,
    );
    runway.style.setProperty('--pin-y', `${(mobile ? 31 : 45) - 7 * t}%`);
    runway.style.setProperty('--pin-scale', String(1 + 0.13 * t));
    scrollAngle = -30 * t;
    turn(manual + scrollAngle);
  }

  const scope = gsap.matchMedia();
  scope.add('(prefers-reduced-motion: no-preference)', () => {
    const trigger = ScrollTrigger.create({
      trigger: runway,
      start: 'top top',
      end: 'bottom top',
      onUpdate: ({ progress }) => {
        scrollProgress = progress;
        applyLayout(progress);
      },
    });
    const resize = () => applyLayout(scrollProgress);
    compact.addEventListener('change', resize);
    if (trigger.progress > 0) applyLayout(trigger.progress);
    return () => {
      trigger.kill();
      compact.removeEventListener('change', resize);
      for (const prop of ['--pin-x', '--pin-y', '--pin-scale'])
        runway.style.removeProperty(prop);
      scrollAngle = 0;
      turn(manual);
    };
  });
}

const runway = document.querySelector<HTMLElement>('.runway');
if (runway) {
  mountPin(
    runway,
    document.querySelector<HTMLImageElement>('#pin')!,
    document.querySelector<HTMLButtonElement>('.pin-control')!,
  );
}

gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  const lenis = new Lenis({
    anchors: true,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  const stopCinema = mountCinema();
  return () => {
    stopCinema();
    lenis.destroy();
  };
});

const players = Array.from(document.querySelectorAll<HTMLElement>('.player'));
const index = Array.from(
  document.querySelectorAll<HTMLAnchorElement>('.player-index a'),
);
if (players.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      const focused = entries.find((entry) => entry.isIntersecting);
      if (!focused) return;
      index.forEach((link) => {
        if (link.hash === '#' + focused.target.id)
          link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-12% 0px -55% 0px' },
  );
  players.forEach((player) => observer.observe(player));
}

const soundButton = document.querySelector<HTMLButtonElement>('.sound')!;
let audio: HTMLAudioElement | undefined;
let enabled = false;
let audioRequest = 0;
function showSound() {
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
});
document.addEventListener('visibilitychange', () => void playSound());
