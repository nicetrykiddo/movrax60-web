import './style.css';
import records from './records.json';
import { initWeather } from './weather';
import { renderArchive, renderTeam } from './archive';

function find<T extends HTMLElement>(selector: string) {
  return document.querySelector<T>(selector)!;
}

const content = find('#content');
const panel = find('#panel');
const range = find<HTMLInputElement>('#cut');
const sound = find<HTMLButtonElement>('#sound');

new MutationObserver(() => {
  find('.sound-state').textContent = sound.getAttribute('aria-pressed') === 'true' ? 'on' : 'off';
}).observe(sound, { attributes: true, attributeFilter: ['aria-pressed'] });

function choose(title: string, place: number) {
  const endings: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const suffix = place % 100 >= 11 && place % 100 <= 13 ? 'th' : endings[place % 10] ?? 'th';
  find('#mark-rank').textContent = String(place);
  find('#mark-name').textContent = title;
  find('#phone-result').textContent = title;
  find('#engraving').textContent = title;
  find('#rank').textContent = place + suffix + ' place';
  if (Number(range.value) === 0) {
    range.value = '65';
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }
  location.hash = 'quarry';
}

let requestedRecord: string | undefined;
for (const link of document.querySelectorAll('.inscription, .phone-feature')) link.addEventListener('click', () => {
  requestedRecord = find('#engraving').textContent ?? undefined;
});

for (const event of [...records.events].sort((a,b)=>a.place-b.place).slice(0,3)) {
  const link=document.createElement('a');
  link.href='#results';
  const rank=document.createElement('strong');
  rank.textContent='#'+event.place;
  const title=document.createElement('span');
  title.textContent=event.title;
  const score=document.createElement('small');
  score.textContent=event.points.toLocaleString('en-GB')+' pts';
  link.append(rank,title,score);
  link.addEventListener('click',()=>{requestedRecord=event.title});
  find('#featured-list').append(link);
}

function route() {
  const view = ['#results', '#team'].includes(location.hash) ? location.hash : '#quarry';
  content.classList.toggle('reading', view !== '#quarry');
  panel.hidden = view === '#quarry';
  for (const link of document.querySelectorAll('nav a')) {
    if (link.getAttribute('href') === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (view === '#results') renderArchive(panel, choose, requestedRecord);
  if (view === '#team') renderTeam(panel);
  const title = view === '#quarry' ? 'The Weather Quarry' : view === '#results' ? 'Results' : 'Team';
  document.title = title + ' — movrax60';
  if (requestedRecord) panel.querySelector('details[open]')?.scrollIntoView({block:'center'});
  else window.scrollTo(0, 0);
  requestedRecord = undefined;
}

window.addEventListener('hashchange', () => {
  route();
  content.focus({ preventScroll: true });
});
route();
initWeather(find<HTMLCanvasElement>('canvas'), range, sound);
