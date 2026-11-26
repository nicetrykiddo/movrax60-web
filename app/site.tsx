import { BrandLink } from './brand';
import records from '../records.json';

export function Header({ members = false }: { members?: boolean }) {
  return (
    <header>
      <BrandLink />
      <nav aria-label="Main navigation">
        <a href="/members/" aria-current={members ? 'page' : undefined}>Members</a>
        <a href="/#results">Results</a>
        <a href="/#contact">Contact</a>
      </nav>
      <button className="sound" type="button" hidden aria-label="Sound off" aria-pressed="false">
        <i aria-hidden="true"><b /><b /><b /><b /><b /></i><span>Sound off</span>
      </button>
    </header>
  );
}

export function InstrumentSurface() {
  return <button className="instrument-surface" type="button" aria-label="Send a pulse through the relay. Drag or use the arrow keys to inspect." hidden />;
}

export const playerId = (handle: string) => 'player-' + handle.toLowerCase();

export function Contact() {
  return (
    <section id="contact" className="contact story-scene" aria-labelledby="contact-title" data-cue="368">
      <div className="scene-copy">
        <p className="kicker"><i aria-hidden="true" /> Contact</p>
        <h2 id="contact-title">Get in <em>touch.</em></h2>
        <p className="lede">CTF invitations, collaborations, or a hello from another team.</p>
        <div className="channels">
          {records.contacts.map(({ label, url }) => url
            ? <a className="channel" key={label} href={url}>{label} <b aria-hidden="true">↗</b></a>
            : <div className="channel pending" key={label}><span>{label}</span><small>Coming soon</small></div>)}
        </div>
        <a className="text-link source" href={records.source}>Team profile on CTFtime <b aria-hidden="true">↗</b></a>
      </div>
      <footer>
        <BrandLink />
        <a className="text-link" href="#top">Back to top <b aria-hidden="true">↑</b></a>
      </footer>
    </section>
  );
}
