import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { playerId } from '../site';
import records from '../../records.json';
export const metadata: Metadata = {
  title: 'Members — movrax60',
  description: 'The eight players on the movrax60 CTF team sheet.',
};
export default function MembersPage() {
  return (
    <div className="directory">
      <main id="main" className="roster">
        <div className="member-sheet">
          <Link className="quiet-link to-film" href="/#team">
            <ArrowLeft /> Return to the flag
          </Link>
          <h1>Team sheet</h1>
          <div className="roster-grid">
            <nav className="roster-nav" aria-label="Choose a member">
              {records.members.map((m) => (
                <a key={m.handle} href={'#' + playerId(m.handle)}>
                  {m.handle}
                </a>
              ))}
            </nav>
            <div className="profiles">
              {records.members.map((m, i) => (
                <article
                  className="profile"
                  id={playerId(m.handle)}
                  key={m.handle}
                >
                  <p className="eyebrow">Player 0{i + 1} / 08</p>
                  <h2>{m.handle}</h2>
                  {m.focus && <p>{m.focus}</p>}
                  <p>First listed in {m.since}.</p>
                  {m.otherTeams && (
                    <p className="other-teams">
                      Also listed with {m.otherTeams.join(' · ')}.
                    </p>
                  )}
                  <a className="action glass" href={m.profile}>
                    CTFtime profile <ArrowUpRight />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
