import Link from 'next/link';
// Vector trace of the supplied movrax60 cloak, shared by the header and team sheet.
export function BrandSymbol() {
  return <svg className="symbols" aria-hidden="true" focusable="false"><symbol id="cloak" viewBox="0 0 100 100"><g transform="translate(-9 112) scale(2.2 -2.2)"><path d="M14 45 c-1 -1 -2 -1 -2 -2 0 -1 0 -1 1 0 1 1 4 0 4 -1 0 -1 -2 -4 -5 -7 -3 -4 -5 -7 -4 -7 0 0 1 -1 1 -2 l0 -2 2 2 c6 5 5 3 -1 -3 -4 -3 -6 -6 -5 -5 1 0 4 -1 6 -2 l4 -2 -2 -2 c-3 -3 -3 -4 0 -4 1 0 2 -1 2 -1 0 -1 1 -1 2 -1 1 1 2 1 2 2 -1 1 1 1 4 1 6 0 10 0 13 2 2 1 4 1 3 0 0 -1 0 -1 1 -1 2 2 1 3 -2 8 -2 2 -3 5 -2 5 0 1 1 0 1 -1 1 -1 1 -1 1 0 1 2 7 6 9 6 2 0 3 3 2 7 l-1 3 0 -3 c0 -1 0 -3 0 -4 0 -3 -1 -2 -3 2 -2 4 -2 6 -1 6 0 -1 1 -1 2 0 0 1 1 1 1 1 1 -1 2 0 2 2 0 1 -1 2 -2 1 -1 0 -2 -1 -3 0 0 0 -2 -2 -3 -4 -3 -4 -5 -5 -7 -1 -1 1 -4 3 -7 4 -2 1 -5 2 -6 3 -2 1 -4 1 -7 0z m31 -3 c0 -1 0 -1 -1 -1 -1 -1 -1 -1 -1 0 0 1 0 1 1 1 1 0 1 0 1 0z m-13 -5 c-1 0 -1 0 -2 0 -1 1 -1 1 0 1 1 0 2 0 2 -1z m-8 -1 c-1 -1 -2 -1 -2 -1 -1 0 -1 0 -1 1 0 1 1 1 2 1 0 0 1 0 1 -1z m-9 -4 c0 -1 0 -1 -1 -1 -1 0 -1 0 -1 1 0 1 0 1 1 1 1 0 1 0 1 -1z m20 -1 c0 0 -1 -2 -2 -2 -2 -1 -2 -1 0 1 3 3 3 4 2 1z m-24 -1 c-1 0 -1 0 -2 0 0 1 0 1 1 1 1 0 1 0 1 -1z m12 -1 c-1 0 -1 0 -2 0 0 1 0 1 1 1 1 0 1 0 1 -1z m2 -4 c-2 -1 -3 -1 -3 0 -1 1 -1 1 2 1 2 0 2 0 1 -1z m-8 -5 c0 -1 0 -2 -1 -2 0 0 0 1 0 2 0 0 0 1 1 1 1 0 1 -1 0 -1z"/><path d="M6 14 c-3 -4 0 -5 6 -2 2 2 2 2 0 2 -1 0 -2 0 -3 1 -1 0 -2 -1 -3 -1z"/><path d="M29 8 c0 -1 1 -2 2 -2 2 0 2 0 2 1 0 1 -1 2 -2 2 -2 0 -2 0 -2 -1z"/></g></symbol></svg>
}
export function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#cloak" /></svg>;
}
export function BrandLink() {
  return <Link className="brand" href="/" aria-label="movrax60 home"><BrandMark /><span>movrax60</span></Link>;
}
