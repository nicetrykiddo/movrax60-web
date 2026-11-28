import { animate } from 'animejs/animation';
import { filmProgress, readingIndex, stops } from './flag-track';

export function attachInterface() {
  const owner=new AbortController(),{signal}=owner;
  const film=document.querySelector<HTMLElement>('.film');
  const directory=document.querySelector<HTMLElement>('.roster');
  const panels=[...document.querySelectorAll<HTMLElement>('.film-stop')];
  const profiles=[...document.querySelectorAll<HTMLElement>('.profile')];
  const choices=[...document.querySelectorAll<HTMLAnchorElement>('.roster-nav a')];
  const links=[...document.querySelectorAll<HTMLAnchorElement>('.marks-nav a')];
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const motion=matchMedia('(prefers-reduced-motion:reduce)');
  let current=-1, frame=0, first=true;
  const activeNodes=film?panels:profiles;
  function select(i:number) {
    if(i===current || !activeNodes[i]) return;
    current=i;
    activeNodes.forEach((el,j)=>{
      el.inert=i!==j;
      el.toggleAttribute('data-active',i===j);
    });
    const choicesHere=film?links:choices, selected=film?i-1:i;
    choicesHere.forEach((a,j)=>{
      if(j===selected)a.setAttribute('aria-current','location');
      else a.removeAttribute('aria-current');
    });
    if(film){
      film.dataset.scene=i===0?'identity':i<=5?'results':i===6?'team':'contact';
      buttons.forEach(b=>b.disabled=Number(b.dataset.step)<0?i<=1:i>=5);
      const advance=film.querySelector<HTMLAnchorElement>('.advance');
      if(advance)advance.href=i===6?'#contact':'#results';
      const copy=activeNodes[i].querySelector('.readout');
      if(copy&&!first&&!motion.matches)animate(copy,{opacity:[.16,1],translateY:[5,0],duration:320,ease:'outCubic'});
    }
    document.dispatchEvent(new CustomEvent('flag:reading',{detail:film?i:6}));
    first=false;
  }
  function memberRange(){return Math.max(1,document.documentElement.scrollHeight-innerHeight);}
  function follow(){
    frame=0;
    if(film)select(readingIndex(filmProgress()));
    else if(directory)select(Math.max(0,Math.min(profiles.length-1,Math.round(scrollY/memberRange()*(profiles.length-1)))));
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(follow);}
  function memberJump(i:number,instant:boolean){
    window.scrollTo({top:memberRange()*i/(profiles.length-1),behavior:instant||motion.matches?'instant':'smooth'});
  }
  function restore(){
    const hash=location.hash;
    if(film && hash){
      const id=hash==='#cyber-apocalypse'?'results':hash.slice(1);
      document.getElementById(id)?.scrollIntoView({behavior:'instant'});
    }
    if(directory){
      const i=choices.findIndex(a=>a.hash===hash);
      if(i>=0)memberJump(i,true);
    }
    follow();
  }
  function moveEvent(delta:number){
    const index=Math.min(5,Math.max(1,current+delta));
    const hash='#'+stops[index].id;
    if(location.hash!==hash)history.pushState(null,'',hash);
    document.getElementById(stops[index].id)?.scrollIntoView({behavior:motion.matches?'instant':'smooth'});
  }
  film?.setAttribute('data-playing','');
  directory?.setAttribute('data-book','');
  buttons.forEach(b=>b.addEventListener('click',()=>moveEvent(Number(b.dataset.step)),{signal}));
  document.addEventListener('flag:step',e=>moveEvent((e as CustomEvent<number>).detail),{signal});
  document.addEventListener('keydown',e=>{
    if(film&&current>=1&&current<=5&&['ArrowRight','ArrowLeft'].includes(e.key)&&!document.querySelector('[role=dialog]')){
      e.preventDefault();moveEvent(e.key==='ArrowRight'?1:-1);
    }
  },{signal});
  choices.forEach((a,i)=>{
    const go=(j:number)=>{
      const next=choices[j];
      if(location.hash!==next.hash)history.pushState(null,'',next.hash);
      memberJump(j,true);follow();next.focus({preventScroll:true});
    };
    a.addEventListener('click',e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();go(i);}},{signal});
    a.addEventListener('keydown',e=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();go(Math.min(profiles.length-1,Math.max(0,i+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1))));
    },{signal});
  });
  addEventListener('hashchange',restore,{signal});
  addEventListener('popstate',restore,{signal});
  addEventListener('scroll',schedule,{signal,passive:true});
  addEventListener('resize',schedule,{signal});
  restore();document.dispatchEvent(new Event('flag:route'));
  return ()=>{owner.abort();cancelAnimationFrame(frame);};
}
