import { ArrowUp, ArrowUpRight } from 'lucide-react';
import { BrandLink } from './brand';
import records from '../records.json';
export const playerId = (handle: string) => 'player-' + handle.toLowerCase();
export function Contact() {
  return <section id="contact" className="contact" aria-labelledby="contact-title">
    <div className="section-width"><div className="contact-main">
      <div><p className="eyebrow">Contact</p><h2 id="contact-title">Get in <em>touch.</em></h2>
        <p className="lede">Have a CTF invite or a question for the crew?</p>
        <a className="action primary" href={records.source}>Find us on CTFtime <ArrowUpRight /></a></div>
      <ul className="channels">{records.contacts.map(({label,url}) => <li key={label}>{url
        ? <a href={url}>{label}<ArrowUpRight /></a>
        : <><span>{label}</span><small>Coming soon</small></>}</li>)}</ul>
    </div><footer><BrandLink /><a className="quiet-link" href="#top">Back to top <ArrowUp size={16}/></a></footer></div>
  </section>;
}
