import records from './records.json';
import './archive.css';

type Competition = (typeof records.events)[number];
type SelectEvent = (title: string, place: number) => void;

const published = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(records.checked));
const number = new Intl.NumberFormat('en-GB');

let selectedYear = 'all';
let sortOrder = 'place';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sourceLink(text: string, href: string): HTMLAnchorElement {
  const link = element('a', 'ledger-link', text);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const arrow = element('span', 'ledger-link-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  link.append(' ', arrow);
  return link;
}

function page(container: HTMLElement, first: string, last: string): HTMLElement {
  const root = element('div', 'ledger');
  const title = element('h1', 'ledger-title', first + ' ');
  title.append(element('em', '', last));
  root.append(title);
  container.replaceChildren(root);
  return root;
}

function addCitation(root: HTMLElement) {
  const note = element('p', 'ledger-citation');
  note.append(sourceLink('CTFtime team record', records.source), element('span', '', 'Recorded ' + published));
  root.append(note);
}

function resultRow(event: Competition, selectEvent: SelectEvent): HTMLDetailsElement {
  const row = element('details', 'record');
  row.setAttribute('name', 'quarry-result');
  const summary = element('summary', 'record-heading');
  const rank = element('span', 'record-rank', '#' + event.place);
  rank.setAttribute('aria-label', 'Place ' + event.place);
  const indicator = element('span', 'record-indicator');
  indicator.setAttribute('aria-hidden', 'true');
  summary.append(rank, element('span', 'record-title', event.title), element('span', 'record-year', String(event.year)), indicator);

  const detail = element('div', 'record-detail');
  const points = element('p', 'record-points');
  points.append(element('strong', '', number.format(event.points)), ' CTF points');
  const actions = element('div', 'record-actions');
  const reveal = element('button', 'record-reveal', 'Reveal in quarry');
  reveal.type = 'button';
  reveal.addEventListener('click', () => selectEvent(event.title, event.place));
  actions.append(reveal, sourceLink('Scoreboard', event.source));
  detail.append(points, actions);
  row.append(summary, detail);
  return row;
}

function selectControl(labelText: string, options: Array<[string, string]>, value: string) {
  const label = element('label', 'ledger-select-label', labelText);
  const select = element('select', 'ledger-select');
  for (const [value, text] of options) {
    const option = element('option', '', text);
    option.value = value;
    select.append(option);
  }
  select.value = value;
  label.append(select);
  return {label, select};
}

export function renderArchive(container: HTMLElement, selectEvent: SelectEvent, featuredTitle?: string): void {
  if (featuredTitle) selectedYear = 'all';
  const root = page(container, 'Competition', 'results');
  const tools = element('div', 'ledger-tools');
  const count = element('span', 'ledger-count');
  count.setAttribute('role', 'status');
  const filters = element('div', 'ledger-filters');
  const dates = [...new Set(records.events.map(event => event.year))].sort((a,b) => b - a);
  const season = selectControl('Season', [['all','All seasons'], ...dates.map((year): [string,string] => [String(year), String(year)])], selectedYear);
  const sort = selectControl('Order', [['place','Best place'], ['recent','Most recent']], sortOrder);
  filters.append(season.label, sort.label);
  tools.append(count, filters);

  const list = element('div', 'record-list');
  list.setAttribute('aria-label', 'Competition records');
  function update() {
    const filtered = records.events.filter(event => selectedYear === 'all' || event.year === Number(selectedYear));
    if (sortOrder === 'place') filtered.sort((left, right) => left.place - right.place);
    list.replaceChildren(...filtered.map(event => resultRow(event, selectEvent)));
    count.textContent = filtered.length + (filtered.length === 1 ? ' competition' : ' competitions');
  }
  season.select.addEventListener('change', () => { selectedYear = season.select.value; update(); });
  sort.select.addEventListener('change', () => { sortOrder = sort.select.value; update(); });
  update();
  root.append(tools, list);
  addCitation(root);
  if (featuredTitle) {
    for (const row of list.querySelectorAll('details')) {
      if (row.querySelector('.record-title')?.textContent === featuredTitle) row.open = true;
    }
  }
}

export function renderTeam(container: HTMLElement): void {
  const root = page(container, 'The', 'team');
  const intro = element('div', 'roster-intro');
  intro.append(element('p', 'roster-description', 'movrax60 is an international capture the flag team.'), element('span', 'ledger-count', records.members.length + ' members'));
  const list = element('ul', 'roster-list');
  for (const member of [...records.members].sort((a, b) => a.handle.localeCompare(b.handle, 'en', {sensitivity: 'base'}))) {
    const item = element('li', 'roster-item');
    const link = sourceLink(member.handle, member.profile);
    link.setAttribute('aria-label', member.handle + ' on CTFtime');
    item.append(link);
    list.append(item);
  }
  root.append(intro, list);
  addCitation(root);
}
