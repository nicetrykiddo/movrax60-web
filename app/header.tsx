'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowUpRight, Menu, Volume2, VolumeX, X } from 'lucide-react';
import { BrandLink } from './brand';
const links = [['Home','/#top'], ['Results','/#results'], ['Members','/members/'], ['Contact','/#contact']];
export function Header({members = false}: {members?: boolean}) {
  const [active,setActive] = useState(members ? 'Members' : 'Home');
  const [on,setOn] = useState(false);
  const [open,setOpen] = useState(false);
  const player = useRef<HTMLAudioElement|null>(null);
  const nav = useRef<HTMLElement|null>(null);
  useEffect(() => {
    const sections = members ? ['contact'] : ['results','team','contact'];
    const names: Record<string,string> = {results:'Results',team:'Members',contact:'Contact'};
    function track() {
      let name = members ? 'Members' : 'Home';
      for (const id of sections) {
        if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= innerHeight*.54) name = names[id];
      }
      setActive(name);
      document.body.classList.toggle('on-paper',name==='Results');
    }
    track(); addEventListener('scroll',track,{passive:true}); addEventListener('resize',track);
    return () => {removeEventListener('scroll',track); removeEventListener('resize',track);
      document.body.classList.remove('on-paper'); player.current?.pause();};
  },[members]);
  useEffect(() => {
    const bar = nav.current;
    if (!bar) return;
    const move = () => {
      const selected = bar.querySelector<HTMLElement>('a[aria-current]');
      if (!selected) return;
      bar.style.setProperty('--pill-left',selected.offsetLeft+'px');
      bar.style.setProperty('--pill-width',selected.offsetWidth+'px');
    };
    move(); const observer = new ResizeObserver(move); observer.observe(bar);
    return () => observer.disconnect();
  },[active]);
  async function toggleAudio() {
    if (!player.current) {player.current = new Audio('/audio/ambient.mp3');
      player.current.loop = true; player.current.volume = .32;}
    if (player.current.paused) {
      try { await player.current.play(); setOn(true); } catch { setOn(false); }
    } else {player.current.pause(); setOn(false);}
  }
  const menuLinks = links.map(([label,href]) => <a key={label}
    href={members && label==='Contact' ? '#contact' : href}
    aria-current={active===label?'location':undefined} onClick={() => setOpen(false)}>
    {label}<ArrowUpRight size={18}/></a>);
  return <header className="bar"><BrandLink />
    <nav className="pill-nav" aria-label="Main navigation" ref={nav}><i aria-hidden="true"/>{menuLinks}</nav>
    <div className="bar-actions"><button className="sound" aria-pressed={on} aria-label={on?'Sound on':'Sound off'} onClick={toggleAudio}>
      {on?<Volume2/>:<VolumeX/>}<span>Sound {on?'on':'off'}</span></button>
      <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger className="mobile-trigger round" aria-label="Menu"><Menu/></Dialog.Trigger>
        <Dialog.Portal><Dialog.Backdrop className="menu-backdrop"/><Dialog.Popup className="menu">
          <div className="menu-head"><Dialog.Title>Menu</Dialog.Title><Dialog.Close className="round" aria-label="Close menu"><X/></Dialog.Close></div>
          <nav aria-label="Mobile navigation">{menuLinks}</nav>
        </Dialog.Popup></Dialog.Portal></Dialog.Root>
    </div><noscript><nav className="plain-nav" aria-label="Page links">{menuLinks}</nav></noscript>
  </header>;
}
