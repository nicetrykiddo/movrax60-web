import { defineConfig } from 'vite';
import records from './records.json' with { type: 'json' };

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number = (n: number) => n.toLocaleString('en-GB');
const slug = (handle: string) => 'player-' + handle.toLowerCase();
const arrow = '<b aria-hidden="true">↗</b>';
const brand = '<img src="/mascot.png" width="36" height="36" alt="">movrax60';
const footer = '<footer><a class="brand" href="/" aria-label="movrax60 home">'+brand+'</a><span>International CTF team</span><a class="text-link" href="#top">Back to top <b aria-hidden="true">↑</b></a></footer>';

function header(members: boolean) {
  return `<header><a class="brand" href="/" aria-label="movrax60 home">${brand}</a>
    <nav aria-label="Main navigation"><a href="/members/"${members?' aria-current="page"':''}>Members</a><a href="/#results">Results</a><a href="/#contact">Contact</a></nav>
    <button class="sound" type="button" hidden aria-label="Sound off" aria-pressed="false"><i aria-hidden="true"><b></b><b></b><b></b><b></b></i><span>Sound off</span></button></header>`;
}

const resultRows = records.featured.map(feature => {
  const event = records.events.find(e => e.source===feature.event)!;
  const points = number(event.points);
  const headline = feature.metric==='points' ? `${points} pts` : `#${event.place}`;
  const detail = feature.field ? `${points} points · ${number(feature.field)} teams` : 'Team score';
  return `<a class="result-row" href="${escape(event.source)}"><span class="meta">${escape(feature.date)}</span><h3>${escape(feature.title)}</h3><span class="placing">${headline}<small>${detail}</small></span><span class="round-arrow" aria-label="View scoreboard">↗</span></a>`;
}).join('');

const star = records.spotlight;
const spotlight = `<div class="spot-grid"><div><h2 id="highlight-title">${escape(star.title).split(' ').join('<br>')}<span>.</span></h2><p class="edition">${escape(star.edition)}</p></div><div class="spot-rank"><strong>0${star.place}</strong><span>Place overall</span></div></div>
<div class="spot-bottom"><div class="spot-stat"><strong>${star.solved} / ${star.challenges}</strong><span>Challenges solved</span></div><div class="spot-stat"><strong>${number(star.points)}</strong><span>Team points</span></div><div class="spot-sources"><a href="${escape(star.source)}" class="text-link">Event page ${arrow}</a><a href="${escape(star.report)}" class="text-link">Player-reported result ${arrow}</a></div></div>`;

const channels = records.contacts.map(({label,url}) => url
  ? `<a class="channel" href="${escape(url)}">${escape(label)} ${arrow}</a>`
  : `<div class="channel pending"><span>${escape(label)}</span><small>Coming soon</small></div>`).join('');
const contact = `<section id="contact" class="contact page-section" aria-labelledby="contact-title"><div><p class="kicker"><i></i> Contact</p><h2 id="contact-title">Get in touch<span>.</span></h2><p class="lede">For CTF invitations, collaborations, or a hello from another team.</p><a class="text-link" href="${records.source}">Team profile on CTFtime ${arrow}</a></div><div class="channels">${channels}</div></section>`;

const handleStrip = records.members.map(m=>`<a href="/members/#${slug(m.handle)}">${escape(m.handle)}</a>`).join('');
const playerIndex = records.members.map(m=>`<a href="#${slug(m.handle)}">${escape(m.handle)}</a>`).join('');
const profiles = records.members.map(m => `<article class="player" id="${slug(m.handle)}"><p class="meta">Capturing flags since <strong>${escape(m.since)}</strong></p><h2>${escape(m.handle)}</h2>
${m.focus ? `<p class="profile-fact"><span>Interests</span> ${escape(m.focus)}</p>` : ''}
${m.otherTeams ? `<p class="profile-fact"><span>Also listed with</span> ${m.otherTeams.map(escape).join(' · ')}</p>` : ''}
<a class="text-link" href="${escape(m.profile)}">CTFtime profile ${arrow}</a></article>`).join('');

export default defineConfig({
  build:{rollupOptions:{input:{home:'index.html',members:'members/index.html'}}},
  plugins:[{name:'team-pages',transformIndexHtml(html,ctx){
    const parts: Record<string,string> = {header:header(ctx.filename.endsWith('/members/index.html')),footer,spotlight,results:resultRows,contact,'handle strip':handleStrip,'player index':playerIndex,members:profiles};
    return html.replace(/<!-- ([a-z ]+) -->/g,(match,key:string)=>parts[key]??match);
  }}]
});
