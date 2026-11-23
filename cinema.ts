type Scene = {
  section: HTMLElement;
  mark?: HTMLElement;
  name: string;
  reverse: boolean;
  top: number;
};

type Exposure = {
  source: HTMLImageElement;
  tile?: { x: number; y: number; width: number; height: number };
};

type Cut = {
  reel: string;
  frame: number;
  count: number;
  from: Scene;
  to: Scene;
  travel: number;
};

const HOLD = 54;
const TRAVEL = 34;
const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const ease = (value: number) => value * value * (3 - 2 * value);
const filename = (index: number) => String(index).padStart(3, '0') + '.webp';

function collectScenes() {
  const scenes: Scene[] = [
    ...document.querySelectorAll<HTMLElement>('.scene-art'),
  ].map((mark) => {
    const section = mark.parentElement!;
    return {
      section,
      mark,
      name: section.classList.contains('roster-intro')
        ? 'intro'
        : mark.dataset.shot!,
      reverse: section.classList.contains('reverse'),
      top: 0,
    };
  });
  const opening = document.querySelector<HTMLElement>('.runway');
  if (opening)
    scenes.unshift({
      section: opening,
      name: 'opening',
      reverse: false,
      top: 0,
    });
  return scenes;
}

function choose(scenes: Scene[], y: number, h: number, bottom: number): Cut {
  const close = 0.22 * h;
  const far = 0.82 * h;
  let i = 0;
  while (i + 1 < scenes.length && y >= scenes[i + 1].top - close) i++;
  const from = scenes[i];
  const to = scenes[i + 1];
  const start = Math.max(0, from.top - close);
  const end = to ? to.top - far : bottom;
  if (to && y > end) {
    const travel = clamp((y - end) / (to.top - close - end));
    return {
      reel: from.name + '-to',
      frame: travel * (TRAVEL - 1),
      count: TRAVEL,
      from,
      to,
      travel,
    };
  }
  const t = clamp((y - start) / Math.max(1, end - start));
  // End the dolly with the same pose used by the first frame of its connector.
  return {
    reel: from.name,
    frame: t * (HOLD - 1),
    count: HOLD,
    from,
    to: from,
    travel: 0,
  };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  exposure: Exposure,
  width: number,
  height: number,
  scale = 1,
) {
  const { source } = exposure;
  const tile = exposure.tile ?? {
    x: 0,
    y: 0,
    width: source.naturalWidth,
    height: source.naturalHeight,
  };
  const zoom = Math.max(width / tile.width, height / tile.height) * scale;
  const w = tile.width * zoom;
  const h = tile.height * zoom;
  ctx.drawImage(
    source,
    tile.x,
    tile.y,
    tile.width,
    tile.height,
    (width - w) / 2,
    (height - h) / 2,
    w,
    h,
  );
}

export function mountCinema() {
  const scenes = collectScenes();
  const screen = document.createElement('div');
  screen.className = 'cinema';
  screen.setAttribute('aria-hidden', 'true');
  screen.innerHTML =
    '<canvas class="cinema-image"></canvas><canvas class="cinema-air"></canvas><div class="cinema-glare"></div>';
  const picture = screen.querySelector<HTMLCanvasElement>('.cinema-image')!;
  const air = screen.querySelector<HTMLCanvasElement>('.cinema-air')!;
  const context = picture.getContext('2d', { alpha: false });
  const airContext = air.getContext('2d');
  if (!context || !airContext || scenes.length === 0) return () => {};
  document.body.prepend(screen);

  const route = document.body.classList.contains('directory')
    ? 'members'
    : 'home';
  const view = matchMedia('(min-aspect-ratio:1/1)');
  const compact = matchMedia('(max-width:760px), (max-aspect-ratio:4/5)');
  const assets = new Map<string, HTMLImageElement>();
  const jobs = new Set<string>();
  const failure = new Map<string, number>();
  const opening = new Image();
  opening.src = '/knit.webp';
  let active = true;
  let ready = false;
  let width = 1;
  let height = 1;
  let viewportHeight = 1;
  let end = 0;
  let y = scrollY;
  let lastTime = 0;
  let lastScroll = performance.now();
  let lastKey = '';
  let lastImage: Exposure | undefined;
  let keyExposure = 0;
  let focusX = 0.72;
  let focusY = 0.4;
  let raf = 0;
  let lastCut = '';
  let highSince = 0;
  const landing = document.getElementById(location.hash.slice(1));
  const opened = performance.now();
  let landingScroll = false;

  function path(reel: string) {
    return `/journey/${route}/${view.matches ? 'wide' : 'tall'}/${reel}/`;
  }

  function asset(url: string) {
    const cached = assets.get(url);
    if (cached) {
      assets.delete(url);
      assets.set(url, cached);
    }
    return cached;
  }

  function load(url: string, priority: 'high' | 'low' = 'low') {
    if (
      assets.has(url) ||
      jobs.has(url) ||
      jobs.size >= 4 ||
      (failure.get(url) ?? 0) > performance.now()
    )
      return;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = priority;
    jobs.add(url);
    image.src = url;
    image
      .decode()
      .then(() => {
        if (!active) return;
        assets.set(url, image);
        let pixels = [...assets.values()].reduce(
          (size, image) => size + image.naturalWidth * image.naturalHeight,
          0,
        );
        while (pixels > 27_000_000 && assets.size > 1) {
          const [key, oldest] = assets.entries().next().value!;
          pixels -= oldest.naturalWidth * oldest.naturalHeight;
          assets.delete(key);
        }
        failure.delete(url);
      })
      .catch(() => {
        failure.set(url, performance.now() + 8000);
      })
      .finally(() => jobs.delete(url));
  }

  function post(scene: Scene): Exposure | undefined {
    const img =
      scene.name === 'opening' ? opening : scene.mark?.querySelector('img');
    return img?.complete && img.naturalWidth ? { source: img } : undefined;
  }

  function atlasTile(
    atlas: HTMLImageElement,
    frame: number,
    count: number,
  ): Exposure {
    const tw = atlas.naturalWidth / 6;
    const th = atlas.naturalHeight / Math.ceil(count / 6);
    return {
      source: atlas,
      tile: {
        x: (frame % 6) * tw,
        y: Math.floor(frame / 6) * th,
        width: tw,
        height: th,
      },
    };
  }

  function prepare(cut: Cut) {
    const url = path(cut.reel);
    const frame = Math.round(cut.frame);
    if (cut.from.name === 'opening')
      load(path('roster') + 'preview.webp', 'high');
    else load(url + 'preview.webp', 'high');

    const i = scenes.indexOf(cut.from);
    const near = scenes[i + 1];
    if (cut.to !== cut.from) {
      load(path(cut.to.name) + 'preview.webp');
    } else if (near) {
      const next =
        cut.from.name === 'opening' ? near.name : cut.from.name + '-to';
      load(path(next) + 'preview.webp');
      if (cut.from.name !== 'opening' && cut.frame > cut.count * 0.45) {
        load(path(near.name) + 'preview.webp');
      }
    }
    if (i > 1) load(path(scenes[i - 1].name + '-to') + 'preview.webp');
    return { url, frame };
  }

  function vignette(reverse: number) {
    const ctx = context!;
    if (compact.matches) {
      const shade = ctx.createLinearGradient(0, height, 0, 0);
      shade.addColorStop(0, '#0b1011f4');
      shade.addColorStop(0.35, '#0c1111be');
      shade.addColorStop(0.62, '#0b101127');
      shade.addColorStop(1, '#0b10114d');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const left = ctx.createLinearGradient(0, 0, width, 0);
    left.addColorStop(0, '#0b1212f2');
    left.addColorStop(0.33, '#0b1112c4');
    left.addColorStop(0.68, '#0b111216');
    left.addColorStop(1, '#0b111201');
    const right = ctx.createLinearGradient(width, 0, 0, 0);
    right.addColorStop(0, '#0a1010f1');
    right.addColorStop(0.29, '#0a1111cb');
    right.addColorStop(0.68, '#0a111111');
    right.addColorStop(1, '#0a111100');
    ctx.globalAlpha = 1 - reverse;
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = reverse;
    ctx.fillStyle = right;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  function render(cut: Cut, now: number) {
    const { url, frame } = prepare(cut);
    const isOpening = cut.from.name === 'opening';
    const atlas = asset(url + 'preview.webp');
    const settled = now - lastScroll > 140 && Math.abs(y - scrollY) < 2;
    // Upgrade the same pose when there is a native exposure for it.
    const still =
      !isOpening && settled && (frame % 2 === 0 || frame === cut.count - 1);
    if (still) load(url + filename(frame), 'high');
    const exact = (still && asset(url + filename(frame))) || undefined;
    if (lastCut !== url + frame) {
      lastCut = url + frame;
      highSince = now;
    } else if (!exact) {
      highSince = now;
    }
    const quality = exact ? ease(clamp((now - highSince) / 155)) : 0;
    let exposure = atlas ? atlasTile(atlas, frame, cut.count) : undefined;
    let next: Exposure | undefined;
    let mix = 0;

    if (isOpening) {
      exposure = post(cut.from);
      const incoming = asset(path(cut.to.name) + 'preview.webp');
      next = incoming ? atlasTile(incoming, 0, HOLD) : post(cut.to);
      mix = ease(cut.travel);
    } else if (!atlas) {
      // Hold the previous camera image while the next strip arrives.
      exposure = lastImage ?? post(cut.from);
      if (exact) exposure = { source: exact };
    }
    if (!exposure) return false;

    const key = `${cut.reel}/${frame}/${Math.round(quality * 18)}/${Boolean(atlas)}/${Boolean(next)}/${isOpening ? Math.round(mix * 120) : 0}`;
    if (lastKey === key) return true;
    if (!isOpening && !atlas && lastImage && !exact) return true;
    lastKey = key;
    const ctx = context!;
    ctx.globalAlpha = 1;
    drawCover(ctx, exposure, width, height, isOpening ? 1 + mix * 0.07 : 1);
    if (next && mix > 0) {
      ctx.globalAlpha = mix;
      drawCover(ctx, next, width, height);
    }
    if (exact && quality > 0 && atlas) {
      ctx.globalAlpha = quality;
      drawCover(ctx, { source: exact }, width, height);
    }
    ctx.globalAlpha = 1;
    const side = Number(cut.from.reverse);
    vignette(side + (Number(cut.to.reverse) - side) * ease(cut.travel));
    if (atlas || exact || isOpening)
      lastImage = quality >= 1 && exact ? { source: exact } : exposure;
    keyExposure = cut.to === cut.from ? 0 : Math.sin(Math.PI * cut.travel);
    screen.dataset.reel = cut.reel;
    screen.dataset.frame = String(frame);
    const owner = cut.travel >= 0.5 ? cut.to : cut.from;
    if (owner.mark) owner.mark.dataset.frame = String(frame);
    if (!ready) {
      ready = true;
      document.body.classList.add('cinema-ready');
    }
    return true;
  }

  // Dust, light and haze share screen space across all of the rendered camera poses.
  const particles = Array.from({ length: 34 }, (_, i) => ({
    x: ((i * 74.193) % 100) / 100,
    y: ((i * 61.417) % 100) / 100,
    depth: 0.21 + ((i * 13.717) % 72) / 100,
  }));

  function atmosphere(time: number) {
    const ctx = airContext!;
    const w = air.width,
      h = air.height;
    ctx.clearRect(0, 0, w, h);
    const fx = (focusX * 0.15 + 0.63 + Math.sin(time * 0.00023) * 0.14) * w;
    const fy = (focusY * 0.12 + 0.29 + Math.cos(time * 0.0003) * 0.13) * h;
    const haze = ctx.createRadialGradient(fx, fy, 0, fx, fy, w * 0.64);
    haze.addColorStop(0, `rgba(200,219,174,${0.045 + keyExposure * 0.087})`);
    haze.addColorStop(0.45, 'rgba(136,170,164,.04)');
    haze.addColorStop(1, 'rgba(140,160,146,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    for (const dust of particles) {
      const drift =
        (time * (0.000009 + dust.depth * 0.000004) + y * 0.00019) * dust.depth;
      const px = ((((dust.x + drift * 0.66) % 1) + 1) % 1) * w;
      const py = ((((dust.y - drift) % 1) + 1) % 1) * h;
      ctx.fillStyle = `rgba(231,237,194,${(0.08 + keyExposure * 0.11) * dust.depth})`;
      ctx.beginPath();
      ctx.ellipse(
        px,
        py,
        0.42 + dust.depth * 1.45,
        0.42 + dust.depth * 0.84,
        -0.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  function resize() {
    viewportHeight = innerHeight;
    const density = Math.min(devicePixelRatio || 1, 1.5, 1580 / innerWidth);
    const nextWidth = Math.round(innerWidth * density);
    const nextHeight = Math.round(innerHeight * density);
    if (nextWidth !== width || nextHeight !== height) {
      width = picture.width = nextWidth;
      height = picture.height = nextHeight;
      air.width = Math.max(1, Math.round(innerWidth * 0.58));
      air.height = Math.max(1, Math.round(innerHeight * 0.58));
      if (lastImage) drawCover(context!, lastImage, width, height);
      lastKey = '';
    }
    const base = scrollY;
    for (const item of scenes)
      item.top = base + item.section.getBoundingClientRect().top;
    end = Math.max(1, document.documentElement.scrollHeight - viewportHeight);
  }

  function onPointer(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    focusX = event.clientX / innerWidth;
    focusY = event.clientY / innerHeight;
    screen.style.setProperty('--glare-x', `${focusX * 100}%`);
    screen.style.setProperty('--glare-y', `${focusY * 100}%`);
  }

  function takeControl() {
    landingScroll = true;
  }

  function tick(time: number) {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const elapsed = lastTime ? Math.min(33, time - lastTime) : 16;
    lastTime = time;
    const target = scrollY;
    const gap = target - y;
    if (Math.abs(gap) > 1) lastScroll = time;
    const speed =
      Math.abs(gap) > viewportHeight * 2.4 ? 0.72 : 1 - Math.exp(-elapsed / 59);
    if (landing && !landingScroll && time - opened < 450) {
      const margin = parseFloat(getComputedStyle(landing).scrollMarginTop) || 0;
      // Resolve the incoming camera at the anchor while the browser restores its scroll.
      y = clamp(landing.getBoundingClientRect().top + target - margin, 0, end);
    } else {
      y = Math.abs(gap) < 0.45 || !ready ? target : y + gap * speed;
    }
    const cut = choose(scenes, y, viewportHeight, end);
    render(cut, time);
    if (ready) atmosphere(time);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(document.querySelector('main')!);
  addEventListener('resize', resize, { passive: true });
  addEventListener('wheel', takeControl, { once: true, passive: true });
  addEventListener('touchstart', takeControl, { once: true, passive: true });
  document.addEventListener('pointermove', onPointer, { passive: true });
  resize();
  raf = requestAnimationFrame(tick);
  return () => {
    active = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    removeEventListener('resize', resize);
    removeEventListener('wheel', takeControl);
    removeEventListener('touchstart', takeControl);
    document.removeEventListener('pointermove', onPointer);
    document.body.classList.remove('cinema-ready');
    scenes.forEach((item) => {
      if (item.mark) delete item.mark.dataset.frame;
    });
    screen.remove();
  };
}
