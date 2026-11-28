import { ArrowLeft } from 'lucide-react';
import { BrandLink } from './brand';
export default function NotFound() {
  return <main id="main" className="missing"><BrandLink/><div>
    <p className="eyebrow">404</p><h1>Page <em>missing.</em></h1>
    <a href="/" className="action primary"><ArrowLeft/> Return to movrax60</a>
  </div></main>;
}
