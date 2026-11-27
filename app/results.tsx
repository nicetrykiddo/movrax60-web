'use client';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import records from '../records.json';
import { Imprint } from './imprint';

const star = records.spotlight;
const number = (n: number) => n.toLocaleString('en-GB');
const ids = ['nullcon','ritsec','script','chronos'];
const editions = [
  {id:'cyber-apocalypse',name:star.title,short:'Cyber Apocalypse',date:star.date,metric:'#'+star.place,
   label:'overall placement',detail:star.solved+' / '+star.challenges+' challenges solved',extra:number(star.points)+' points',
   source:star.source,report:star.report,sub:star.organizer+' · '+star.edition},
  ...records.featured.map((f,i) => {
    const e = records.events.find(({source})=>source===f.event)!;
    const points = f.metric==='points';
    return {id:ids[i],name:f.title,short:['Goa HackIM','RITSEC','scriptCTF','Chronos'][i],date:f.date,
      metric:points?number(e.points):'#'+e.place,label:points?'team points':'overall placement',
      detail:points?'Competition scoreboard':number(e.points)+' points',extra:f.field?number(f.field)+' competing teams':'',
      source:e.source,report:'',sub:'CTFtime · Competition record'};
  })
];
const inks = ['#823a30','#3d4948','#4c3956','#a4582e','#343348'];
const foil = ['#ffcf96','#f7d8a5','#f3c5d3','#fff0d1','#cebff2'];
const ordinal = (i:number) => String(i+1).padStart(2,'0');
export function CompetitionResults() {
  const [ref,api] = useEmblaCarousel({align:'start',loop:false,watchFocus:false});
  const [selected,setSelected] = useState(0);
  useEffect(()=>{
    if (!api) return;
    const sync = () => setSelected(api.selectedScrollSnap());
    const fromHash = () => {
      const i = editions.findIndex(e => '#'+e.id===location.hash);
      if(i>=0) { api.scrollTo(i,true); document.getElementById('results')?.scrollIntoView({behavior:'instant'}); }
    };
    api.on('select',sync).on('reInit',sync);
    fromHash(); addEventListener('hashchange',fromHash);
    return ()=>{api.off('select',sync).off('reInit',sync);removeEventListener('hashchange',fromHash);};
  },[api]);
  function go(i:number) {
    api?.scrollTo(i,matchMedia('(prefers-reduced-motion:reduce)').matches);
  }
  return <section id="results" className="archive" aria-labelledby="archive-title">
    <div className="section-width">
      <div className="archive-heading"><div><p className="eyebrow">Competition archive</p>
        <h2 id="archive-title">Selected <em>results.</em></h2></div>
        <span className="archive-count">Five editions <span aria-hidden="true">/</span> 2026</span></div>
      <div className="shelf">
        <div className="embla" ref={ref} role="region" aria-label="Competition results" tabIndex={0}
          onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(selected+(e.key==='ArrowRight'?1:-1));}}}>
          <div className="editions">{editions.map((e,i)=><article key={e.id} id={e.id} className="edition"
             inert={api && i!==selected ? true : undefined} style={{'--ink':inks[i],'--foil':foil[i]} as CSSProperties}>
            <div className="cover"><span className="cover-code">movrax60 <b>/ {ordinal(i)}</b></span>
              <h3>{e.name}</h3><Imprint edition={i}/><span className="cover-date">{e.date}</span></div>
            <div className="record"><p className="eyebrow">{e.sub}</p><strong className="metric">{e.metric}</strong>
              <p className="metric-label">{e.label}</p><div className="facts">{e.detail}{e.extra && <><br/>{e.extra}</>}</div>
              <div className="sources">{e.report && <a href={e.report}>Player-reported result <ArrowUpRight/></a>}
              <a href={e.source}>{e.report?'Event page':'View scoreboard'} <ArrowUpRight/></a></div></div>
          </article>)}</div>
        </div>
        <nav className="spines" aria-label="Choose a competition">
          {editions.map((e,i)=><button key={e.id} aria-label={e.name} aria-current={i===selected?'true':undefined}
            onClick={()=>go(i)} style={{'--ink':inks[i],'--foil':foil[i]} as CSSProperties}>
            <small>{ordinal(i)}</small><strong>{e.short}</strong><span aria-hidden="true">✳</span>
          </button>)}
        </nav>
      </div>
      <div className="archive-controls"><span className="counter" aria-live="polite">{ordinal(selected)} / 05</span>
        <span className="swipe-note">Browse editions</span>
        <button className="round" aria-label="Previous competition" disabled={!selected} onClick={()=>go(selected-1)}><ArrowLeft/></button>
        <button className="round" aria-label="Next competition" disabled={selected===4} onClick={()=>go(selected+1)}><ArrowRight/></button></div>
    </div>
  </section>;
}
