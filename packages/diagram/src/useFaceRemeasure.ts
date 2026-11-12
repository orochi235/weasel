import { useLatest, type Scene } from '@weasel-js/core';
import { useEffect } from 'react';
import { installFaceRemeasure, type RemeasureOptions } from './faceRemeasure';

/**
 * Measure `scene`'s bodies, labels and sequences again whenever the
 * registered faces change, for the life of the calling component
 * ({@link installFaceRemeasure}). Options are read when the faces change.
 */
export function useFaceRemeasure<TPose>(scene: Scene<unknown, string, TPose>, opts: RemeasureOptions): void {
  const latest = useLatest(opts);
  useEffect(() => installFaceRemeasure(scene, {
    get measure() { return latest.current.measure; },
    get theme() { return latest.current.theme; },
  }), [scene, latest]);
}
