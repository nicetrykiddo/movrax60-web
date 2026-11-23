import { defineConfig } from 'vite';
import records from './records.json' with { type: 'json' };

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
const number = (n: number) => n.toLocaleString('en-GB');
const slug = (handle: string) => 'player-' + handle.toLowerCase();
const arrow = '<b aria-hidden="true">↗</b>';
const brand = '<img src="/mascot.png" width="36" height="36" alt="">movrax60';
const footer = `<footer><a class="brand" href="/" aria-label="movrax60 home">${brand}</a><span>International CTF team</span><a class="text-link" href="#top">Back to top <b aria-hidden="true">↑</b></a></footer>`;

function header(members: boolean) {
  return `<header><a class="brand" href="/" aria-label="movrax60 home">${brand}</a>
    <nav aria-label="Main navigation"><a href="/members/"${members ? ' aria-current="page"' : ''}>Members</a><a href="/#results">Results</a><a href="/#contact">Contact</a></nav>
    <button class="sound" type="button" hidden aria-label="Sound off" aria-pressed="false"><i aria-hidden="true"><b></b><b></b><b></b><b></b></i><span>Sound off</span></button></header>`;
}

function backdrop(shot: string, frames = 30) {
  const poster = frames === 30 ? '016' : '005';
  const art = '/scenes/' + shot;
  return `<div class="scene-art" data-shot="${shot}" data-frames="${frames}" aria-hidden="true">
    <picture><source media="(max-aspect-ratio: 1/1)" srcset="${art}/tall/${poster}.webp">
      <img src="${art}/wide/${poster}.webp" alt="" loading="lazy" decoding="async">
    </picture>
  </div>`;
}

const resultScenes = ['nullcon', 'ritsec', 'script', 'chronos'];
const results = records.featured
  .map((feature, index) => {
    const event = records.events.find(
      (entry) => entry.source === feature.event,
    )!;
    const points = number(event.points);
    const showScore = feature.metric === 'points';
    const headline = showScore ? points : '#' + event.place;
    const detail = showScore ? 'Team points' : 'Overall placement';
    const stats = feature.field
      ? `<p class="result-detail">${points} points · ${number(feature.field)} teams</p>`
      : '';
    const shot = resultScenes[index];
    return `<section class="story-scene result-scene page-section${index % 2 ? ' reverse' : ''}" id="${shot}" aria-labelledby="${shot}-title">
    ${backdrop(shot)}
    <div class="scene-copy">
      <p class="kicker"><i></i> ${escape(feature.date)}</p>
      <h2 id="${shot}-title">${escape(feature.title)}<span>.</span></h2>
      <div class="stat"><strong>${headline}</strong><span>${detail}</span></div>
      ${stats}
      <a class="text-link" href="${escape(event.source)}">View scoreboard ${arrow}</a>
    </div>
  </section>`;
  })
  .join('');

const star = records.spotlight;
const spotlight = `${backdrop('salt')}
  <div class="scene-copy">
    <p class="kicker"><i></i> ${escape(star.organizer)} / ${escape(star.date)}</p>
    <h2 id="highlight-title">Cyber<br>Apocalypse<span>.</span></h2>
    <p class="edition">${escape(star.edition)}</p>
    <div class="stat"><strong>#${star.place}</strong><span>Overall<br>placement</span></div>
    <p class="result-detail">${star.solved}/${star.challenges} challenges solved · ${number(star.points)} points</p>
    <div class="source-links">
      <a href="${escape(star.source)}" class="text-link">Event page ${arrow}</a>
      <a href="${escape(star.report)}" class="text-link">Player-reported result ${arrow}</a>
    </div>
  </div>`;

const channels = records.contacts
  .map(({ label, url }) =>
    url
      ? `<a class="channel" href="${escape(url)}">${escape(label)} ${arrow}</a>`
      : `<div class="channel pending"><span>${escape(label)}</span><small>Coming soon</small></div>`,
  )
  .join('');
const contact = `<section id="contact" class="contact story-scene page-section" aria-labelledby="contact-title">
  ${backdrop('contact')}
  <div class="scene-copy">
    <p class="kicker"><i></i> Contact</p>
    <h2 id="contact-title">Get in<br>touch<span>.</span></h2>
    <p class="lede">For CTF invitations, collaborations, or a hello from another team.</p>
    <div class="channels">${channels}</div>
    <a class="text-link" href="${records.source}">Team profile on CTFtime ${arrow}</a>
  </div>
  ${footer}
</section>`;

const handleStrip = records.members
  .map(
    (member) =>
      `<a href="/members/#${slug(member.handle)}">${escape(member.handle)}</a>`,
  )
  .join('');
const playerIndex = records.members
  .map(
    (member) =>
      `<a href="#${slug(member.handle)}">${escape(member.handle)}</a>`,
  )
  .join('');
const profiles = records.members
  .map((member, index) => {
    const id = slug(member.handle);
    return `<article class="player story-scene${index % 2 ? ' reverse' : ''}" id="${id}" aria-labelledby="${id}-title">
    ${backdrop(id, 10)}
    <div class="scene-copy">
      <p class="kicker"><i></i> Capturing flags since ${escape(member.since)}</p>
      <h2 id="${id}-title">${escape(member.handle)}</h2>
      ${member.focus ? `<p class="profile-fact"><span>Interests</span> ${escape(member.focus)}</p>` : ''}
      ${member.otherTeams ? `<p class="profile-fact"><span>Also listed with</span> ${member.otherTeams.map(escape).join(' · ')}</p>` : ''}
      <a class="text-link" href="${escape(member.profile)}">CTFtime profile ${arrow}</a>
    </div>
  </article>`;
  })
  .join('');

export default defineConfig({
  build: {
    rollupOptions: {
      input: { home: 'index.html', members: 'members/index.html' },
    },
  },
  plugins: [
    {
      name: 'team-pages',
      transformIndexHtml(html, ctx) {
        const parts: Record<string, string> = {
          header: header(ctx.filename.endsWith('/members/index.html')),
          spotlight,
          results,
          contact,
          'roster scene': backdrop('roster'),
          'handle strip': handleStrip,
          'player index': playerIndex,
          members: profiles,
        };
        return html.replace(
          /<!-- ([a-z ]+) -->/g,
          (match, key: string) => parts[key] ?? match,
        );
      },
    },
  ],
});
