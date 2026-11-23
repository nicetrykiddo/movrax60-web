import { defineConfig } from 'vite';
import records from './records.json' with { type: 'json' };

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const sorted = [...records.events].sort((a,b) => a.place-b.place);
const best = sorted[0];
const highlight = `<h2 id="event">${escape(best.title)}<span>.</span></h2><p class="result-line"><strong>#${best.place}</strong><span>Team placement<br>${best.points.toLocaleString('en-GB')} CTF points</span></p><a class="score" href="${escape(best.source)}">Official result ↗</a>`;
const team = records.members.map(m => `<li><a href="${escape(m.profile)}">${escape(m.handle)} <span aria-hidden="true">↗</span></a></li>`).join('');
export default defineConfig({plugins:[{
  name:'team-records',
  transformIndexHtml(html) {
    return html.replace('<!-- highlight -->',highlight).replace('<!-- roster -->',team)
      .replaceAll('{{members}}',String(records.members.length)).replaceAll('{{events}}',String(records.events.length));
  }
}]});
