import { animate } from 'animejs/animation';
export function attachInterface() {
  let dispose: (()=>void)|undefined;
  let gone=false;
  void import('./textile').then(({mountTextile})=>{if(!gone)dispose=mountTextile();});
  const motion=matchMedia('(prefers-reduced-motion:reduce)');
  const show=new IntersectionObserver(entries=>{
    for(const e of entries)if(e.isIntersecting){
      if(!motion.matches)animate(e.target,{opacity:[.80,1],y:[8,0],duration:430,ease:'outCubic'});
      show.unobserve(e.target);
    }
  },{threshold:.16});
  document.querySelectorAll('.archive-heading,.team-grid>div,.contact-main>div,.profile h2').forEach(el=>show.observe(el));
  const index=[...document.querySelectorAll<HTMLAnchorElement>('.roster-nav a')];
  const articles=[...document.querySelectorAll<HTMLElement>('.profile')];
  const owner=new AbortController(), signal=owner.signal;
  function update(){
    let active=0;
    articles.forEach((article,i)=>{if(article.getBoundingClientRect().top<=innerHeight*.52)active=i;});
    index.forEach((link,i)=>{if(i===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }
  if(index.length){
    update();addEventListener('scroll',update,{passive:true,signal});addEventListener('resize',update,{signal});
    index.forEach((link,i)=>link.addEventListener('keydown',e=>{
      if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(e.key))return;
      e.preventDefault();
      const next=index[Math.min(index.length-1,Math.max(0,i+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)))];
      next.focus({preventScroll:true});next.click();
    },{signal}));
  }
  return ()=>{gone=true;owner.abort();show.disconnect();dispose?.();};
}
