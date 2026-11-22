import { defineConfig } from 'vite';
import records from './records.json' with { type: 'json' };

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const sorted = [...records.events].sort((a,b) => a.place-b.place);
const top = sorted.slice(0,3).map(e => `<a class="finish" href="${escape(e.source)}"><strong><small>#</small>${e.place}</strong><span>${escape(e.title)}</span><i aria-hidden="true">↗</i></a>`).join('');
const team = records.members.map(m => `<li><a href="${escape(m.profile)}">${escape(m.handle)} <span aria-hidden="true">↗</span></a></li>`).join('');
const rows = records.events.map(e => `<tr data-year="${e.year}" data-place="${e.place}"><td>#${e.place}</td><th scope="row"><a href="${escape(e.source)}">${escape(e.title)}</a></th><td>${e.points.toLocaleString('en-GB')}</td></tr>`).join('');
export default defineConfig({plugins:[{
  name:'team-records',
  transformIndexHtml(html) {
    return html.replace('<!-- finishes -->',top).replace('<!-- roster -->',team).replace('<!-- events -->',rows)
      .replaceAll('{{members}}',String(records.members.length)).replaceAll('{{events}}',String(records.events.length));
  }
}]});
