import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Contact, playerId } from '../site';
import { Header } from '../header';
import records from '../../records.json';
export const metadata: Metadata = {title:'Members — movrax60',description:'Meet the players on the movrax60 CTF roster.'};
export default function MembersPage() {
  return <div className="directory"><Header members/><main id="main"><section className="roster">
    <div className="section-width"><p className="eyebrow">movrax60 / Team sheet</p>
      <h1>The <em>roster.</em></h1><p className="lede">Eight handles. One international CTF team.</p>
      <div className="roster-grid"><nav className="roster-nav" aria-label="Choose a member">
        {records.members.map(({handle},i)=><a key={handle} href={'#'+playerId(handle)}><small>{String(i+1).padStart(2,'0')}</small>{handle}<ArrowUpRight/></a>)}
      </nav><div className="profiles">{records.members.map((m,i)=><article className="profile" key={m.handle} id={playerId(m.handle)}>
        <p className="eyebrow">Player {String(i+1).padStart(2,'0')} / 08</p>
        <h2>{m.handle}</h2><dl><dt>First listed</dt><dd>{m.since}</dd>
          {m.focus && <><dt>Interests</dt><dd>{m.focus}</dd></>}{m.otherTeams && <><dt>Also listed with</dt><dd>{m.otherTeams.join(' · ')}</dd></>}
        </dl><a className="quiet-link" href={m.profile}>CTFtime profile <ArrowUpRight/></a></article>)}</div></div>
      <a className="quiet-link" href="/#team"><ArrowLeft/> Back to the team</a>
    </div></section><Contact/></main></div>;
}
