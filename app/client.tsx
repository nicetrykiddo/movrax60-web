'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { attachInterface } from '../main';
export function SceneClient() {
  const pathname = usePathname();
  useEffect(() => {
    let disposed = false;
    let close: (() => void) | undefined;
    import('../textile').then(({ mountTextile }) => {
      if (!disposed) close = mountTextile();
    });
    return () => {
      disposed = true;
      close?.();
    };
  }, []);
  useEffect(() => attachInterface(), [pathname]);
  return null;
}
