'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { attachInterface } from '../main';

export function SceneClient() {
  const pathname = usePathname();
  useEffect(() => attachInterface(), [pathname]);
  return null;
}
