const FRAME_RATE = 30;
const reels = [
  { name: 'entrance', start: 0, length: 76 },
  { name: 'interior', start: 76, length: 115 },
  { name: 'passage', start: 191, length: 106 },
  { name: 'contact', start: 297, length: 73 },
] as const;
const LAST_FRAME = 369;

type Cue = { element: HTMLElement; top: number; frame: number; right: number };
type Slot = {
  video: HTMLVideoElement;
  decoded: number;
  requested: number;
  waiting: boolean;
  failed: boolean;
};
const limit = (x: number, lower = 0, upper = 1) =>
  Math.min(upper, Math.max(lower, x));
const blend = (a: number, b: number, t: number) => a + (b - a) * t;

export function mountCinema() {
  const main = document.querySelector('main');
  if (!main) return () => {};
  const cues: Cue[] = [...main.querySelectorAll<HTMLElement>('[data-cue]')].map(
    (element) => ({
      element,
      top: 0,
      frame: Number(element.dataset.cue),
      right: Number(element.classList.contains('reverse')),
    }),
  );
  const scene = document.createElement('div');
  scene.className = 'relay-stage';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML =
    '<div class="relay-shade"></div><div class="relay-shade right"></div><canvas class="rain"></canvas><div class="ember-light"></div><div class="mist distant"></div><div class="mist"></div>';
  document.body.prepend(scene);
  const portrait = matchMedia('(max-aspect-ratio:1/1)');
  const rain = scene.querySelector<HTMLCanvasElement>('.rain')!;
  const weather = rain.getContext('2d')!;
  const slots = new Map<string, Slot>();
  let front: Slot | undefined;
  let view = portrait.matches ? 'tall' : 'wide';
  let bottom = 1;
  let frame = cues[0]?.frame ?? 0;
  let pointerX = 0.69;
  let pointerY = 0.4;
  let lightX = pointerX;
  let lightY = pointerY;
  let paintedLightX = lightX;
  let paintedLightY = lightY;
  let last = 0;
  let rainAt = 0;
  let lastFrame = -1;
  let id = 0;

  function videoFor(name: string, preload: 'auto' | 'metadata' = 'auto') {
    const key = view + '/' + name;
    const prior = slots.get(key);
    if (prior) {
      if (preload === 'auto' && prior.video.preload !== 'auto')
        prior.video.preload = 'auto';
      return prior;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = preload;
    const item: Slot = {
      video,
      decoded: -1,
      requested: 0,
      waiting: false,
      failed: false,
    };
    video.addEventListener('loadeddata', () => {
      if (!item.waiting) item.decoded = 0;
    });
    video.addEventListener('seeked', () => {
      item.waiting = false;
      item.decoded = item.requested;
    });
    video.addEventListener('error', () => {
      item.failed = true;
    });
    video.src = '/relay/' + key + '.mp4';
    scene.prepend(video);
    slots.set(key, item);
    return item;
  }

  function show(item: Slot) {
    if (front === item) return;
    if (front) delete front.video.dataset.active;
    front = item;
    item.video.dataset.active = '';
    document.body.classList.add('relay-active');
  }

  function discard(key: string, slot: Slot) {
    slot.video.removeAttribute('src');
    slot.video.load();
    slot.video.remove();
    slots.delete(key);
  }

  function dimensions() {
    const y = scrollY;
    for (const cue of cues) {
      const inset =
        parseFloat(getComputedStyle(cue.element).scrollMarginTop) || 0;
      cue.top = Math.max(
        0,
        y + cue.element.getBoundingClientRect().top - inset,
      );
    }
    if (cues[0]) cues[0].top = 0;
    bottom = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const width = Math.round(innerWidth * 0.64);
    const height = Math.round(innerHeight * 0.64);
    if (rain.width !== width) rain.width = width;
    if (rain.height !== height) rain.height = height;
  }

  function at(y: number) {
    const index = cues.findIndex(
      (cue, i) => i === cues.length - 1 || y < cues[i + 1].top,
    );
    const near = cues[index] ?? { top: 0, frame: 0, right: 0 };
    const far = cues[index + 1] ?? {
      top: bottom,
      frame: LAST_FRAME,
      right: near.right,
    };
    const part = limit((y - near.top) / Math.max(1, far.top - near.top));
    const fade = limit((part - 0.27) / 0.49);
    return {
      frame: blend(near.frame, far.frame, part),
      right: blend(near.right, far.right, fade * fade * (3 - 2 * fade)),
    };
  }

  // Rain falls beyond the glass. Fog in front is a separate DOM layer.
  const droplets = Array.from({ length: 125 }, (_, i) => ({
    x: (i * 0.6166219) % 1,
    y: (i * 0.38196601) % 1,
    depth: 0.21 + ((i * 0.46287) % 0.79),
    phase: i * 0.1817,
  }));
  function atmosphere(time: number, strength: number) {
    if (!weather || time - rainAt < 31) return;
    rainAt = time;
    const w = rain.width,
      h = rain.height;
    weather.clearRect(0, 0, w, h);
    if (strength < 0.055) return;
    for (const drop of droplets) {
      const phase = time * (0.00012 + drop.depth * 0.00022);
      const x = ((drop.x + phase * 0.088) % 1) * w;
      const y = ((drop.y + phase) % 1) * h;
      const distance = (6 + drop.depth * 19) * Math.max(0.74, h / 620);
      const mask = limit((x / w - 0.32) * 1.85) * limit(1.35 - y / h);
      weather.strokeStyle = `rgba(248,223,193,${0.25 * strength * drop.depth * mask})`;
      weather.lineWidth = 0.52 + 0.42 * drop.depth;
      weather.beginPath();
      weather.moveTo(x, y);
      weather.lineTo(x + distance * 0.14, y + distance);
      weather.stroke();
    }
  }

  function move(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    pointerX = 0.51 + (event.clientX / Math.max(1, innerWidth)) * 0.28;
    pointerY = 0.27 + (event.clientY / Math.max(1, innerHeight)) * 0.29;
  }

  function switchView() {
    view = portrait.matches ? 'tall' : 'wide';
    // Leave the last sharp image visible until the new composition is decoded.
  }

  function tick(time: number) {
    id = requestAnimationFrame(tick);
    if (document.hidden) return;
    const elapsed = last ? Math.min(38, time - last) : 16;
    last = time;
    const sample = at(scrollY);
    const gap = sample.frame - frame;
    frame =
      !front || Math.abs(gap) > 95 || Math.abs(gap) < 0.45
        ? sample.frame
        : frame + gap * (1 - Math.exp(-elapsed / 63));
    const wanted = limit(Math.round(frame), 0, LAST_FRAME);
    const reelIndex = reels.findIndex(
      (reel) => wanted >= reel.start && wanted < reel.start + reel.length,
    );
    const reel = reels[reelIndex];
    if (!reel) return;
    const position = wanted - reel.start;
    const item = videoFor(reel.name);
    if (item.failed && front) {
      delete front.video.dataset.active;
      document.body.classList.remove('relay-active');
      front = undefined;
    }
    if (
      !item.failed &&
      item.video.readyState >= HTMLMediaElement.HAVE_METADATA &&
      !item.waiting &&
      item.decoded !== position
    ) {
      item.requested = position;
      item.waiting = true;
      item.video.currentTime = (position + 0.13) / FRAME_RATE;
    }
    if (
      !item.failed &&
      item.decoded >= 0 &&
      Math.abs(position - item.decoded) <= 2
    ) {
      show(item);
      scene.dataset.reel = reel.name;
      scene.dataset.frame = String(reel.start + item.decoded);
      scene.dataset.view = view;
    }

    const next = reels[reelIndex + 1],
      previous = reels[reelIndex - 1];
    const neighbor =
      position < reel.length * 0.22 && (wanted < lastFrame || !next)
        ? previous
        : next;
    if (neighbor && item.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
      videoFor(
        neighbor.name,
        position > reel.length * 0.42 ? 'auto' : 'metadata',
      );
    if (wanted !== lastFrame || !front) {
      for (const [key, slot] of slots) {
        if (
          slot === item ||
          slot === front ||
          key === view + '/' + neighbor?.name
        )
          continue;
        discard(key, slot);
      }
      lastFrame = wanted;
    }
    lightX += (pointerX - lightX) * 0.066;
    lightY += (pointerY - lightY) * 0.066;
    const external = Math.max(limit(1 - frame / 74), limit((frame - 302) / 58));
    scene.style.setProperty('--right', String(sample.right));
    scene.style.setProperty('--mist', String(0.24 + external * 0.47));
    if (
      Math.abs(lightX - paintedLightX) + Math.abs(lightY - paintedLightY) >
      0.0012
    ) {
      scene.style.setProperty('--ember-x', `${lightX * 100}%`);
      scene.style.setProperty('--ember-y', `${lightY * 100}%`);
      paintedLightX = lightX;
      paintedLightY = lightY;
    }
    atmosphere(time, external);
  }

  const observer = new ResizeObserver(dimensions);
  observer.observe(main);
  addEventListener('resize', dimensions, { passive: true });
  addEventListener('pointermove', move, { passive: true });
  portrait.addEventListener('change', switchView);
  dimensions();
  id = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(id);
    observer.disconnect();
    removeEventListener('resize', dimensions);
    removeEventListener('pointermove', move);
    portrait.removeEventListener('change', switchView);
    document.body.classList.remove('relay-active');
    for (const [key, slot] of slots) discard(key, slot);
    scene.remove();
  };
}
