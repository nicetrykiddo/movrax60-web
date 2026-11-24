import gsap from 'gsap';
import { mountCinema } from './cinema';

const entry = performance.getEntriesByType('navigation')[0] as
  | PerformanceNavigationTiming
  | undefined;
if (entry?.type === 'navigate' && scrollY === 0 && location.hash.length > 1) {
  document
    .getElementById(location.hash.slice(1))
    ?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  const highlights = document.querySelectorAll<HTMLElement>(
    '.button,.sound,.player-plate,.plate-step,.player-index a,nav a,.source-links a,.channel,.text-link,.scroll-cue',
  );
  function reflect(this: HTMLElement, event: PointerEvent) {
    const bounds = this.getBoundingClientRect();
    this.style.setProperty(
      '--light-x',
      `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
    );
    this.style.setProperty(
      '--light-y',
      `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
    );
  }
  const held = new Map<HTMLElement, Animation>();
  function press(this: HTMLElement, event: PointerEvent) {
    if (event.button !== 0) return;
    held.get(this)?.cancel();
    held.set(
      this,
      this.animate([{ scale: '1' }, { scale: '.958' }], {
        duration: 120,
        easing: 'ease-out',
        fill: 'forwards',
      }),
    );
  }
  function release(this: HTMLElement) {
    if (!held.has(this)) return;
    held.get(this)?.cancel();
    held.delete(this);
    this.animate(
      [{ scale: '.958' }, { scale: '1.017', offset: 0.56 }, { scale: '1' }],
      { duration: 270, easing: 'ease-out' },
    );
  }
  const resetEvents = ['pointerup', 'pointercancel', 'pointerleave'] as const;
  highlights.forEach((item) => {
    item.addEventListener('pointerdown', press);
    resetEvents.forEach((event) => item.addEventListener(event, release));
  });
  highlights.forEach((item) =>
    item.addEventListener('pointermove', reflect, { passive: true }),
  );
  const reveals = document.querySelectorAll<HTMLElement>(
    '.story-scene .scene-copy',
  );
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('copy-arrived');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.19 },
  );
  reveals.forEach((copy) => {
    copy.classList.add('copy-reveal');
    observer.observe(copy);
  });
  return () => {
    observer.disconnect();
    reveals.forEach((copy) =>
      copy.classList.remove('copy-reveal', 'copy-arrived'),
    );
    held.forEach((animation) => animation.cancel());
    highlights.forEach((item) => {
      item.removeEventListener('pointerdown', press);
      resetEvents.forEach((event) => item.removeEventListener(event, release));
    });
    highlights.forEach((item) =>
      item.removeEventListener('pointermove', reflect),
    );
  };
});

gsap.matchMedia().add(
  {
    motion: '(prefers-reduced-motion: no-preference)',
    still: '(prefers-reduced-motion: reduce)',
  },
  (context) => {
    return mountCinema(Boolean(context.conditions?.still));
  },
);

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
    link.addEventListener('pointerenter', show);
    link.addEventListener('focus', show);
    link.addEventListener('pointerleave', hide);
    link.addEventListener('blur', hide);
    link.addEventListener('click', hide);
  });
  addEventListener('scroll', track, { passive: true });
  addEventListener('resize', track, { passive: true });
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
    { passive: true },
  );
  addEventListener('resize', follow, { passive: true });
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
  previous.addEventListener('click', () => step(-1, false));
  next.addEventListener('click', () => step(1, false));
  directory.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1, true);
  });
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
  });
  document.addEventListener('visibilitychange', () => void playSound());
}
