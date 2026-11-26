import records from '../records.json';
import { Header, Contact, InstrumentSurface, playerId } from './site';
import { CompetitionResults } from './results';

export default function HomePage() {
  return (
    <div className="home">
      <Header />
      <main id="main">
        <section className="hero story-scene" id="identity" aria-labelledby="hero-title" data-cue="0">
          <div className="scene-copy hero-copy">
            <p className="kicker"><i aria-hidden="true" /> International CTF team</p>
            <h1 id="hero-title">movrax<em>60</em></h1>
            <p className="lede">We play capture the flag across time zones, from cryptography to reverse engineering.</p>
            <div className="actions">
              <button type="button" className="pulse-action button" hidden>
                <i className="pulse-glyph" aria-hidden="true" /><span>Send a pulse</span>
              </button>
              <a className="text-link" href="#results">Our results <b aria-hidden="true">↘</b></a>
            </div>
            <span className="sr-only" role="status" id="pulse-status" />
          </div>
          <InstrumentSurface />
          <div className="hero-foot">
            <a className="scroll-cue" href="#team"><span className="scroll-icon" aria-hidden="true">↓</span> Scroll to explore</a>
            <div className="figure-note">
              <div><span className="figure-label">Optical relay</span><span className="figure-instruction">Drag to inspect</span></div>
              <button className="cover-toggle" type="button" data-cover="" aria-pressed="false" hidden>
                <i aria-hidden="true" /><span className="cover-label">Lift cover</span>
              </button>
            </div>
          </div>
        </section>
        <section className="crew story-scene reverse" id="team" aria-labelledby="crew-title" data-cue="89">
          <div className="scene-copy">
            <p className="kicker"><i aria-hidden="true" /> The team</p>
            <h2 id="crew-title">Behind the <em>handles.</em></h2>
            <p className="lede">Eight players on one international CTF team sheet.</p>
            <a className="button secondary-button" href="/members/">Meet the team <b aria-hidden="true">↗</b></a>
            <nav className="room-roster" aria-label="Team profiles">
              {records.members.map(({handle}) => <a key={handle} href={'/members/#' + playerId(handle)}>{handle}</a>)}
            </nav>
          </div>
        </section>
        <CompetitionResults />
        <Contact />
      </main>
    </div>
  );
}
