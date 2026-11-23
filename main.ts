import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
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
    const preview = wrapFrame(Math.round(position / 4) * 4);
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
      const tile = 384;
      const index = preview / 4;
      context!.drawImage(
        atlas,
        (index % 6) * tile,
        Math.floor(index / 6) * tile,
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

  function tick() {
    frameRequest = 0;
    const diff = target - position;
    if (Math.abs(diff) < 0.45 || reduced.matches) position = target;
    else position += diff * 0.14;
    render();
    if (pending.size < 3) {
      for (const index of [position, position + direction * 2, target]) {
        if (pending.size >= 3) break;
        loadFrame(wrapFrame(index));
      }
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
  control.addEventListener('click', () => {
    manual += frameCount / 2;
    turn(manual + scrollAngle);
  });
  hit.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
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
  const shots = gsap.utils.toArray<HTMLElement>('.scene-art');
  const stopShots = shots.map(mountShot);
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let reflectedArt: HTMLElement | null = null;
  function reflect(event: PointerEvent) {
    if (!finePointer.matches || event.pointerType === 'touch') return;
    const next =
      (event.target as Element)
        .closest('.story-scene')
        ?.querySelector<HTMLElement>('.scene-art') ?? null;
    if (next !== reflectedArt) {
      reflectedArt?.style.removeProperty('--reflection');
      reflectedArt = next;
    }
    if (!reflectedArt) return;
    const bounds = reflectedArt.getBoundingClientRect();
    reflectedArt.style.setProperty(
      '--reflection-x',
      `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
    );
    reflectedArt.style.setProperty(
      '--reflection-y',
      `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
    );
    reflectedArt.style.setProperty('--reflection', '1');
  }
  document.addEventListener('pointermove', reflect, { passive: true });
  gsap.utils.toArray<HTMLElement>('.scene-copy').forEach((copy) => {
    gsap.fromTo(
      copy,
      { y: 34 },
      {
        y: 0,
        scrollTrigger: {
          trigger: copy.parentElement,
          start: 'top 96%',
          end: 'top 30%',
          scrub: 0.38,
        },
      },
    );
  });
  gsap.to('header', {
    '--page-progress': '100%',
    ease: 'none',
    scrollTrigger: {
      start: 0,
      end: () => ScrollTrigger.maxScroll(window),
      scrub: 0.3,
    },
  });
  return () => {
    stopShots.forEach((stop) => stop());
    document.removeEventListener('pointermove', reflect);
    reflectedArt?.style.removeProperty('--reflection');
    lenis.destroy();
  };
});

function mountShot(art: HTMLElement) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return () => {};
  art.append(canvas);
  const landscape = matchMedia('(min-aspect-ratio: 1/1)');
  const total = Number(art.dataset.frames);
  const cache = new Map<number, HTMLImageElement>();
  const loading = new Set<number>();
  const failed = new Set<number>();
  const playhead = { position: 0 };
  let generation = 0;
  let desired = 0;
  let active = false;
  let forward = 1;

  function paint() {
    const image = cache.get(desired);
    if (!image || art.dataset.frame === String(desired)) return;
    if (
      canvas.width !== image.naturalWidth ||
      canvas.height !== image.naturalHeight
    ) {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    }
    context!.drawImage(image, 0, 0);
    art.dataset.frame = String(desired);
  }

  function fill() {
    if (!active) return;
    const view = landscape.matches ? 'wide' : 'tall';
    for (const frame of [
      desired,
      desired + forward,
      desired - forward,
      desired + 2 * forward,
    ]) {
      if (loading.size >= 2) break;
      if (
        frame < 0 ||
        frame >= total ||
        cache.has(frame) ||
        loading.has(frame) ||
        failed.has(frame)
      )
        continue;
      const image = new Image();
      const started = generation;
      loading.add(frame);
      image.decoding = 'async';
      image.src = `/scenes/${art.dataset.shot}/${view}/${String(frame).padStart(3, '0')}.webp`;
      image
        .decode()
        .then(() => {
          if (started === generation) {
            cache.set(frame, image);
            for (const index of cache.keys()) {
              if (Math.abs(desired - index) > 3) cache.delete(index);
            }
            paint();
          }
        })
        .catch(() => {
          if (started === generation) failed.add(frame);
        })
        .finally(() => {
          if (started !== generation) return;
          loading.delete(frame);
          fill();
        });
    }
  }

  function onPosition() {
    art.style.setProperty('--art-drift', `${(0.5 - playhead.position) * 3.5}%`);
    const next = Math.round(playhead.position * (total - 1));
    if (next === desired) return;
    forward = next > desired ? 1 : -1;
    desired = next;
    paint();
    fill();
  }

  function reset() {
    generation++;
    cache.clear();
    loading.clear();
    failed.clear();
    delete art.dataset.frame;
  }

  const shot = gsap.to(playhead, {
    position: 1,
    ease: 'none',
    onUpdate: onPosition,
    scrollTrigger: {
      trigger: art.parentElement,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.25,
      onToggle: ({ isActive }) => {
        active = isActive;
        if (isActive) fill();
        else reset();
      },
    },
  });
  active = Boolean(shot.scrollTrigger?.isActive);
  fill();
  function changeView() {
    reset();
    fill();
  }
  landscape.addEventListener('change', changeView);
  return () => {
    active = false;
    reset();
    art.style.removeProperty('--art-drift');
    landscape.removeEventListener('change', changeView);
    shot.scrollTrigger?.kill();
    shot.kill();
    canvas.remove();
  };
}

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
