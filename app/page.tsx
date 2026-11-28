import {
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Hand,
} from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Result, editions } from './results';
import { BrandMark } from './brand';
import { stops } from '../flag-track';
import records from '../records.json';

function Stop({ index, children }: { index: number; children: ReactNode }) {
  const stop = stops[index];
  return (
    <section
      className="film-stop"
      id={stop.id}
      data-stop={index}
      style={{ '--at': stop.at } as CSSProperties}
    >
      <div className="readout">{children}</div>
    </section>
  );
}
export default function HomePage() {
  return (
    <div className="home">
      <main className="film" id="main">
        <div className="stage-fallback" aria-hidden="true">
          <BrandMark />
        </div>
        <Stop index={0}>
          <p className="eyebrow">International CTF team</p>
          <h1>
            movrax<span>60</span>
          </h1>
          <p className="lede">We play capture the flag across time zones.</p>
          <a className="action primary" href="#results">
            Explore results <ArrowDownRight />
          </a>
        </Stop>
        {editions.map((event, i) => (
          <Stop key={event.name} index={i + 1}>
            <Result index={i} />
          </Stop>
        ))}
        <Stop index={6}>
          <p className="eyebrow">
            Members <span>/</span> 08 players
          </p>
          <h2>The roster.</h2>
          <p className="lede">Eight players on our CTFtime team sheet.</p>
          <Link className="action primary" href="/members/">
            Meet the team <ArrowUpRight />
          </Link>
        </Stop>
        <Stop index={7}>
          <p className="eyebrow">Contact</p>
          <h2>Get in touch.</h2>
          <p className="lede">CTF invites, collaborations and hellos.</p>
          <a className="action primary" href={records.source}>
            CTFtime <ArrowUpRight />
          </a>
          <ul className="contact-links">
            {records.contacts.map(({ label, url }) => (
              <li key={label}>
                {url ? <a href={url}>{label} ↗</a> : <span>{label}</span>}
              </li>
            ))}
          </ul>
          {records.contacts.some((c) => !c.url) && (
            <small className="pending">More links coming soon</small>
          )}
        </Stop>
        <button
          className="grab"
          type="button"
          aria-label="Grab the flag. Drag horizontally or press to lift."
          aria-pressed="false"
        />
        <button className="fold" type="button" aria-pressed="false">
          <Hand size={16} />
          <span>Lift the hem</span>
        </button>
        <div className="film-foot">
          <a className="advance" href="#results">
            <ArrowDown /> Scroll to explore
          </a>
          <nav className="marks-nav" aria-label="Choose a competition">
            <button data-step="-1" aria-label="Previous competition">
              <ArrowLeft />
            </button>
            {editions.map((e, i) => (
              <a
                key={e.name}
                href={'#' + stops[i + 1].id}
                aria-label={e.name}
                title={e.name}
              >
                <i />
              </a>
            ))}
            <button data-step="1" aria-label="Next competition">
              <ArrowRight />
            </button>
          </nav>
          <a className="return-top" href="#top">
            <ArrowUp /> Return to the flag
          </a>
        </div>
      </main>
    </div>
  );
}
