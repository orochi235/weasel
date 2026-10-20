import { useEffect, useRef } from 'react';
import { releaseImageSource } from '@weasel-js/core/renderer';
import type { EffectRun } from './types';

/** Free the texture of each preview a new run no longer shows, and of every
 *  one on unmount, rather than leave it until the bitmap is collected. Runs
 *  after `DiagramView` has reconciled the run that replaced it. */
export function useReleaseReplaced(run: EffectRun | undefined): void {
  const shown = useRef(new Set<ImageBitmap>());
  useEffect(() => {
    const now = new Set(Object.values(run?.stages ?? {}).flatMap((s) => Object.values(s.previews ?? {})));
    for (const old of shown.current) if (!now.has(old)) releaseImageSource(old);
    shown.current = now;
  }, [run]);
  useEffect(() => () => {
    for (const old of shown.current) releaseImageSource(old);
    shown.current = new Set();
  }, []);
}
