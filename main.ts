const year = document.querySelector<HTMLSelectElement>('#year')!;
const order = document.querySelector<HTMLSelectElement>('#order')!;
const body = document.querySelector('tbody')!;
const original = Array.from(body.rows);

function updateArchive() {
  const rows = [...original];
  if (order.value === 'best') rows.sort((a,b) => Number(a.dataset.place)-Number(b.dataset.place));
  for (const row of rows) row.hidden = !!year.value && row.dataset.year !== year.value;
  body.replaceChildren(...rows);
}
document.querySelector<HTMLElement>('.filters')!.hidden=false;
year.addEventListener('change',updateArchive);
order.addEventListener('change',updateArchive);

const hero = document.querySelector<HTMLElement>('.hero')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
hero.addEventListener('pointermove', event => {
  if (motion.matches || event.pointerType !== 'mouse') return;
  const box=hero.getBoundingClientRect();
  hero.style.setProperty('--tilt', ((event.clientX-box.left)/box.width*5-2.5)+'deg');
});
hero.addEventListener('pointerleave',()=>hero.style.removeProperty('--tilt'));
