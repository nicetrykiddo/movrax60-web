import { ArrowUpRight } from 'lucide-react';
import records from '../records.json';

const star = records.spotlight;
const number = (n: number) => n.toLocaleString('en-GB');
export const editions = [
  {
    name: star.title,
    metric: '#' + star.place + ' overall',
    line:
      star.solved +
      ' / ' +
      star.challenges +
      ' solved · ' +
      number(star.points) +
      ' points',
    date: star.organizer + ' · ' + star.edition,
    source: star.source,
    report: star.report,
  },
  ...records.featured.map((f) => {
    const e = records.events.find((event) => event.source === f.event)!;
    return {
      name: f.title,
      metric:
        f.metric === 'points'
          ? number(e.points) + ' points'
          : '#' + e.place + ' of ' + number(f.field!) + ' teams',
      line: f.metric === 'points' ? 'Team score' : number(e.points) + ' points',
      date: f.date,
      source: e.source,
      report: '',
    };
  }),
];
export function Result({ index }: { index: number }) {
  const event = editions[index];
  return (
    <>
      <p className="eyebrow">
        Results <span>/</span> 0{index + 1} of 05
      </p>
      <h2>{event.name}</h2>
      <p className="result-stat">{event.metric}</p>
      <p className="result-line">{event.line}</p>
      <p className="result-meta">
        {event.report ? 'Player-reported placement · ' : ''}
        {event.date}
      </p>
      <div className="film-actions">
        {event.report && (
          <a className="action glass" href={event.report}>
            Player profile <ArrowUpRight />
          </a>
        )}
        <a
          className={event.report ? 'quiet-link' : 'action glass'}
          href={event.source}
        >
          {event.report ? 'Event page' : 'Scoreboard'} <ArrowUpRight />
        </a>
      </div>
    </>
  );
}
