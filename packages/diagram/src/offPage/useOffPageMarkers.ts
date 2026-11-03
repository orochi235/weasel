import { useLatest, type Scene } from '@weasel-js/core';
import { useEffect } from 'react';
import { installOffPageMarkers, type OffPageMarkerOptions } from './install';

/**
 * Split `scene`'s connectors across pages for the life of the calling
 * component (`installOffPageMarkers`): each edit splits or joins the
 * connectors whose ends it moved, and retags every split connector, since a
 * page edit may have renamed or renumbered the page a tag names, in that
 * edit's own history entry.
 * Options are read when the scene changes.
 */
export function useOffPageMarkers<TPose>(scene: Scene<unknown, string, TPose>, opts: OffPageMarkerOptions = {}): void {
  const latest = useLatest(opts);
  useEffect(() => installOffPageMarkers(scene, latest.current), [scene, latest]);
}
