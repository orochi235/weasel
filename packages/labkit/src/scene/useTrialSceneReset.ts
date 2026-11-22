import { useLatest } from '@weasel-js/core';
import { useEffect } from 'react';
import { sceneResetsOf } from './sceneResets';

/** Calls `onReset` each time a Reset loads into `scene`, after `useTrialScene` has loaded it and selected
 *  what a fresh scene selects, so state kept beside the scene can return to how the trial opened. */
export function useTrialSceneReset(scene: object, onReset: () => void): void {
  const latest = useLatest(onReset);
  useEffect(() => sceneResetsOf(scene).subscribe(() => latest.current()), [scene, latest]);
}
