import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import records from '../../records.json';
import { Header, Contact, InstrumentSurface, playerId } from '../site';
import { BrandMark } from '../brand';

export const metadata: Metadata = {
  title: 'Members — movrax60',
  description: 'Meet the movrax60 members and explore their public CTF profiles.',
};

const members = records.members;
const playerCues = [104, 124, 147, 166, 218, 239, 258, 278];
const ordinal = (value: number) => String(value).padStart(2, '0');

export default function MembersPage() {
  return (
    <div className="directory">
      <Header members />
      <main id="main">
        <section className="roster-intro story-scene" id="roster" aria-labelledby="roster-title" data-cue="89">
          <div className="scene-copy">
            <p className="kicker"><i aria-hidden="true" /> movrax60 / Members</p>
            <h1 id="roster-title">The <em>roster.</em></h1>
            <p className="lede">The eight handles on our CTFtime team sheet.</p>
            <div className="actions"><a className="button secondary-button" href="#players">Browse players <b aria-hidden="true">↓</b></a></div>
          </div>
          <InstrumentSurface />
        </section>
        <section className="member-directory" id="players" aria-label="Player profiles">
          <aside className="member-stage">
            <div className="plate-rack">
              {members.map(({handle}, index) => (
                <a key={handle} href={'#' + playerId(handle)} data-plate={index} className="player-plate" aria-label={handle + ' profile'}
                  style={{'--offset': index, '--distance': index, '--deck-order': members.length - index} as CSSProperties}>
                  <span className="plate-face">
                    <small>movrax60 &nbsp; / &nbsp; Team sheet</small><BrandMark /><strong>{handle}</strong>
                    <b aria-hidden="true">{ordinal(index + 1)} / {ordinal(members.length)}</b>
                  </span>
                </a>
              ))}
              <button className="plate-step previous" type="button" aria-label="Previous player" hidden>←</button>
              <button className="plate-step next" type="button" aria-label="Next player" hidden>→</button>
            </div>
            <nav className="player-index" aria-label="Choose a player">
              {members.map(({handle}) => <a key={handle} href={'#' + playerId(handle)}>{handle}</a>)}
            </nav>
          </aside>
          <div className="players">
            {members.map((member, index) => {
              const id = playerId(member.handle);
              return (
                <article className="player story-scene" key={id} id={id} aria-labelledby={id + '-title'} data-cue={playerCues[index]}>
                  <div className="scene-copy">
                    <p className="kicker"><i aria-hidden="true" /> Player {ordinal(index + 1)} / {ordinal(members.length)}</p>
                    <h2 id={id + '-title'}>{member.handle}</h2>
                    <p className="profile-fact"><span>First listed</span> {member.since}</p>
                    {member.focus && <p className="profile-fact"><span>Interests</span> {member.focus}</p>}
                    {member.otherTeams && <p className="profile-fact"><span>Also listed with</span> {member.otherTeams.join(' · ')}</p>}
                    <a className="text-link source" href={member.profile}>CTFtime profile <b aria-hidden="true">↗</b></a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <Contact />
      </main>
    </div>
  );
}
