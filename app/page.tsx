import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Hand } from 'lucide-react';
import records from '../records.json';
import { Header } from './header';
import { Contact, playerId } from './site';
import { CompetitionResults } from './results';
import { BrandMark } from './brand';
export default function HomePage() {
  return <div className="home"><Header/><main id="main">
    <section className="hero-track" aria-labelledby="hero-title">
      <div className="hero">
        <div className="loom-fallback" aria-hidden="true"><BrandMark/></div>
        <div className="hero-copy"><p className="eyebrow">International CTF team</p>
          <h1 id="hero-title">movrax<span>60</span></h1>
          <p className="lede">Competitive cybersecurity, played together across time zones.</p>
          <a className="action primary" href="#results">Explore results <ArrowDownRight/></a>
        </div>
        <button className="grab" aria-label="Grab the flag. Drag horizontally or press to lift." aria-pressed="false" hidden/>
        <button className="fold" type="button" aria-pressed="false" hidden><Hand/><span>Pick up the fold</span></button>
        <a className="scroll-label" href="#results"><ArrowDown/> Scroll to explore</a>
      </div>
    </section>
    <CompetitionResults/>
    <section className="team" id="team" aria-labelledby="team-title">
      <div className="section-width team-grid"><div><p className="eyebrow">The crew</p>
        <h2 id="team-title">Behind the <em>handles.</em></h2>
        <p className="lede">Eight players on the movrax60 team sheet.</p>
        <a className="action primary" href="/members/">Meet the team <ArrowRight/></a></div>
        <nav className="handles" aria-label="Team members">{records.members.map((m,i)=>
          <a href={'/members/#'+playerId(m.handle)} key={m.handle}><small>{String(i+1).padStart(2,'0')}</small>{m.handle}<ArrowUpRight/></a>)}</nav>
      </div>
    </section><Contact/>
  </main></div>;
}
