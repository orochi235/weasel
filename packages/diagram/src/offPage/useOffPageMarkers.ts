import { useLatest, type Scene } from '@weasel-js/core';
import { useEffect } from 'react';
import { installOffPageMarkers, type OffPageMarkerOptions } from './install';

/**
 * Split `scene`'s connectors across pages for the life of the calling
 * component: each edit that moves a connector's end or changes the pages
 * splits, joins, and retags what it reached, in its own history entry.
 * Options are read when the scene changes.
 */
export function useOffPageMarkers<TPose>(scene: Scene<unknown, string, TPose>, opts: OffPageMarkerOptions<TPose> = {}): void {
  const latest = useLatest(opts);
  useEffect(() => installOffPageMarkers(scene, latest.current), [scene, latest]);
}
