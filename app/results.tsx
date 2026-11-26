import records from '../records.json';

const resultIds = ['nullcon', 'ritsec', 'script', 'chronos'];
const resultCues = [170, 222, 265, 320];
const highlights = [
  { id: 'results', title: records.spotlight.title },
  ...records.featured.map((feature, index) => ({id: resultIds[index], title: feature.title})),
];
const number = (value: number) => value.toLocaleString('en-GB');
const ordinal = (value: number) => String(value).padStart(2, '0');

function RecordIndex({ position }: { position: number }) {
  return <p className="record-index">Competition record <span>{ordinal(position)} / {ordinal(highlights.length)}</span></p>;
}

function Spotlight() {
  const star = records.spotlight;
  return (
    <section className="spotlight story-scene" id="results" aria-labelledby="highlight-title" data-cue="138">
      <div className="scene-copy">
        <RecordIndex position={1} />
        <p className="kicker"><i aria-hidden="true" /> {star.organizer} / {star.date}</p>
        <h2 id="highlight-title">Cyber <em>Apocalypse</em></h2>
        <p className="edition">{star.edition}</p>
        <div className="stat"><strong>#{star.place}</strong><span>overall placement</span></div>
        <p className="result-detail">{star.solved}/{star.challenges} challenges solved · {number(star.points)} points</p>
        <div className="source-links">
          <a href={star.source} className="text-link source">Event page <b aria-hidden="true">↗</b></a>
          <a href={star.report} className="text-link source">Player-reported result <b aria-hidden="true">↗</b></a>
        </div>
      </div>
    </section>
  );
}

export function CompetitionResults() {
  return (
    <>
      <Spotlight />
      {records.featured.map((feature, index) => {
        const event = records.events.find(({source}) => source === feature.event)!;
        const id = resultIds[index];
        const points = feature.metric === 'points';
        return (
          <section key={id} className={'story-scene result-scene' + (index % 2 ? ' reverse' : '')}
            id={id} aria-labelledby={id + '-title'} data-cue={resultCues[index]}>
            <div className="scene-copy">
              <RecordIndex position={index + 2} />
              <p className="kicker"><i aria-hidden="true" /> {feature.date}</p>
              <h2 id={id + '-title'}>{feature.title}</h2>
              <div className="stat"><strong>{points ? number(event.points) : '#' + event.place}</strong>
                <span>{points ? 'team points' : 'overall placement'}</span></div>
              {feature.field && <p className="result-detail">{number(event.points)} points across a field of {number(feature.field)} teams.</p>}
              <a className="text-link source" href={event.source}>View scoreboard <b aria-hidden="true">↗</b></a>
            </div>
          </section>
        );
      })}
      <nav className="result-dial" aria-label="Competition highlights" hidden>
        <div className="result-preview" aria-hidden="true"><span /></div>
        {highlights.map(({id, title}, index) => (
          <a href={'#' + id} key={id} aria-label={title}>
            <i aria-hidden="true" /><span aria-hidden="true">{ordinal(index + 1)}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
