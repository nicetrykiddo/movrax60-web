import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);
const portrait = matchMedia('(max-aspect-ratio:1/1)');
const canvas = document.querySelector('canvas')!;
const context = canvas.getContext('2d', { alpha: false });
const label = document.querySelector<HTMLElement>('#shot-name')!;
const lastFrame = 127;
const chapterAt = (frame: number) => (frame < 40 ? 0 : frame < 84 ? 1 : 2);
const names = ['Projection', 'Film transport', 'Registration'];
const stills = [0, 62, lastFrame];

function describe(progress: number) {
  label.textContent = names[chapterAt(Math.round(progress * lastFrame))];
  document.documentElement.style.setProperty(
    '--progress',
    (progress * 100).toFixed(2) + '%',
  );
}

// All cameras, geometry and optics are rendered offline. Keep just a short
// neighbourhood of decoded frames in the browser, even when the reader jumps.
function filmPlayer(ctx: CanvasRenderingContext2D) {
  const cache = new Map<number, HTMLImageElement>();
  const pending = new Set<number>();
  const retryAt = new Map<number, number>();
  let generation = 0,
    desired = 0,
    direction = 1,
    alive = true,
    lastPaint = '';

  function paint() {
    const rounded = Math.round(desired);
    const shot = chapterAt(rounded);
    const candidates = [...cache.keys()].filter(
      (key) => chapterAt(key) === shot,
    );
    if (!candidates.length) return;
    let first = candidates.reduce((a, b) =>
      Math.abs(a - desired) <= Math.abs(b - desired) ? a : b,
    );
    let second = first,
      blend = 0;
    const low = Math.floor(desired),
      high = low + 1;
    if (
      shot !== 0 &&
      cache.has(low) &&
      cache.has(high) &&
      chapterAt(low) === chapterAt(high)
    ) {
      first = low;
      second = high;
      blend = Math.round((desired - low) * 20) / 20;
    }
    const id = [first, second, blend].join('/');
    if (id === lastPaint) return;
    lastPaint = id;
    ctx.drawImage(cache.get(first)!, 0, 0, canvas.width, canvas.height);
    if (blend > 0) {
      ctx.globalAlpha = blend;
      ctx.drawImage(cache.get(second)!, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    canvas.dataset.frame = String(blend > 0.5 ? second : first);
    document.documentElement.classList.add('film-ready');
  }

  function load(index: number) {
    const run = generation;
    const image = new Image();
    pending.add(index);
    image.decoding = 'async';
    const filename =
      String(Math.floor(index)).padStart(3, '0') +
      (Number.isInteger(index) ? '' : 'a') +
      '.webp';
    image.src =
      '/film/' + (portrait.matches ? 'tall' : 'wide') + '/' + filename;
    image
      .decode()
      .then(() => {
        if (!alive || run !== generation) return;
        retryAt.delete(index);
        cache.set(index, image);
        for (const key of cache.keys()) {
          if (Math.abs(desired - key) > 5 && !stills.includes(key))
            cache.delete(key);
        }
      })
      .catch(() => {
        if (alive && run === generation)
          retryAt.set(index, performance.now() + 15000);
      })
      .finally(() => {
        if (!alive || run !== generation) return;
        pending.delete(index);
        paint();
        fill();
      });
  }
  function fill() {
    const step = desired < 39 ? 0.5 : 1;
    const key = Math.round(desired / step) * step;
    const next =
      step === 0.5
        ? [
            key,
            key + direction * step,
            key - direction * step,
            key + direction,
            0,
          ]
        : [
            key,
            Math.floor(desired),
            Math.ceil(desired),
            key + direction,
            key + direction * 2,
            key - direction,
            stills[chapterAt(key)],
          ];
    for (const index of next) {
      if (pending.size >= 3) break;
      if (
        (index > 39 && !Number.isInteger(index)) ||
        index < 0 ||
        index > lastFrame ||
        pending.has(index) ||
        cache.has(index) ||
        (retryAt.get(index) ?? 0) > performance.now()
      )
        continue;
      load(index);
    }
  }
  function resize() {
    generation++;
    cache.clear();
    pending.clear();
    retryAt.clear();
    lastPaint = '';
    canvas.width = portrait.matches ? 768 : 1440;
    canvas.height = portrait.matches ? 1024 : 864;
    document.documentElement.classList.remove('film-ready');
    fill();
  }
  portrait.addEventListener('change', resize);
  resize();
  return {
    seek(value: number) {
      const clamped = Math.min(lastFrame, Math.max(0, value));
      if (clamped === desired && !retryAt.size) return;
      if (clamped !== desired) direction = clamped > desired ? 1 : -1;
      desired = clamped;
      paint();
      fill();
    },
    stop() {
      alive = false;
      generation++;
      cache.clear();
      pending.clear();
      portrait.removeEventListener('change', resize);
      document.documentElement.classList.remove('film-ready');
      delete canvas.dataset.frame;
    },
  };
}

gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  if (!context) return;
  const lenis = new Lenis({
    anchors: true,
    smoothWheel: true,
    syncTouch: false,
    duration: 0.85,
  });
  lenis.on('scroll', ScrollTrigger.update);
  const player = filmPlayer(context);
  let target = 0,
    position = 0,
    velocity = 0,
    priorTime = 0;
  const trigger = ScrollTrigger.create({
    start: 0,
    end: () => Math.max(1, ScrollTrigger.maxScroll(window)),
    onUpdate: (self) => {
      target = self.progress * lastFrame;
      describe(self.progress);
    },
    onRefresh: (self) => {
      target = self.progress * lastFrame;
    },
  });
  position = target;
  function tick(time: number) {
    lenis.raf(time * 1000);
    const elapsed = Math.min(0.05, Math.max(0, time - priorTime));
    priorTime = time;
    if (document.hidden) return;
    const dt = elapsed / 4;
    for (let step = 0; step < 4; step++) {
      velocity += ((target - position) * 240 - velocity * 29) * dt;
      position += velocity * dt;
    }
    if (Math.abs(position - target) < 0.015 && Math.abs(velocity) < 0.1) {
      position = target;
      velocity = 0;
    }
    player.seek(position);
  }
  gsap.ticker.add(tick);
  return () => {
    gsap.ticker.remove(tick);
    trigger.kill();
    lenis.destroy();
    player.stop();
  };
});

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function nativeProgress() {
  if (reduced.matches || !context)
    describe(
      scrollY /
        Math.max(1, document.documentElement.scrollHeight - innerHeight),
    );
}
window.addEventListener('scroll', nativeProgress, { passive: true });
reduced.addEventListener('change', nativeProgress);
nativeProgress();

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
    audio = new Audio('/audio/transport.mp3');
    audio.loop = true;
    audio.volume = 0.28;
  }
  enabled = !enabled;
  showSound();
  void playSound();
});
document.addEventListener('visibilitychange', () => void playSound());
