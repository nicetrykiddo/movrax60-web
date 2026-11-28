'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowUpRight, Menu, Volume2, VolumeX, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { filmProgress, readingIndex } from '../flag-track';
import { BrandLink } from './brand';
const links = [
  ['Home', '/#top'],
  ['Results', '/#results'],
  ['Members', '/members/'],
  ['Contact', '/#contact'],
];
export function Header() {
  const path = usePathname();
  const members = path === '/members' || path === '/members/';
  const [active, setActive] = useState(members ? 'Members' : 'Home');
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    function track() {
      const i = readingIndex(filmProgress());
      setActive(
        members
          ? 'Members'
          : i === 0
            ? 'Home'
            : i < 6
              ? 'Results'
              : i === 6
                ? 'Members'
                : 'Contact',
      );
    }
    track();
    document.addEventListener('flag:reading', track);
    return () => document.removeEventListener('flag:reading', track);
  }, [members]);
  useEffect(() => () => player.current?.pause(), []);
  async function toggleAudio() {
    if (!player.current) {
      player.current = new Audio('/audio/ambient.mp3');
      player.current.loop = true;
      player.current.volume = 0.32;
    }
    if (player.current.paused) {
      try {
        await player.current.play();
        setOn(true);
      } catch {
        setOn(false);
      }
    } else {
      player.current.pause();
      setOn(false);
    }
  }
  const menuLinks = links.map(([label, href]) => {
    const dest = label === 'Members' && !members ? '/#team' : href;
    const props = {
      href: dest,
      'aria-current': active === label ? ('location' as const) : undefined,
      onClick: () => setOpen(false),
    };
    const title = (
      <>
        {label}
        <ArrowUpRight size={18} />
      </>
    );
    return !members && dest.startsWith('/#') ? (
      <a key={label} {...props} href={dest.slice(1)}>
        {title}
      </a>
    ) : (
      <Link key={label} {...props}>
        {title}
      </Link>
    );
  });
  if (!members && path !== '/') return null;
  return (
    <header className="bar">
      <BrandLink />
      <nav className="pill-nav" aria-label="Main navigation">
        {menuLinks}
      </nav>
      <div className="bar-actions">
        <button
          className="sound"
          aria-pressed={on}
          aria-label={on ? 'Sound on' : 'Sound off'}
          onClick={toggleAudio}
        >
          {on ? <Volume2 /> : <VolumeX />}
          <span>Sound {on ? 'on' : 'off'}</span>
        </button>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="mobile-trigger round" aria-label="Menu">
            <Menu />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="menu-backdrop" />
            <Dialog.Popup className="menu">
              <div className="menu-head">
                <Dialog.Title>Menu</Dialog.Title>
                <Dialog.Close className="round" aria-label="Close menu">
                  <X />
                </Dialog.Close>
              </div>
              <nav aria-label="Mobile navigation">{menuLinks}</nav>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <noscript>
        <nav className="plain-nav" aria-label="Page links">
          {menuLinks}
        </nav>
      </noscript>
    </header>
  );
}
