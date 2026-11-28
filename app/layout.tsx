import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SceneClient } from './client';
import { Header } from './header';
import { BrandSymbol } from './brand';
import '../style.css';

export const metadata: Metadata = {
  title: 'movrax60 — International CTF team',
  description:
    'movrax60 is an international capture the flag team. Meet the players and explore selected competition results.',
};
export const viewport: Viewport = {
  themeColor: '#171519',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body id="top">
        <a className="skip" href="#main">
          Skip to content
        </a>
        <BrandSymbol />
        <Header />
        {children}
        <SceneClient />
      </body>
    </html>
  );
}
