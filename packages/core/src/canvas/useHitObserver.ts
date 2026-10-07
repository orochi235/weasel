import { useMemo, type MutableRefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { SceneCanvasHit } from './SceneCanvas';

type Picker = ((x: number, y: number) => { id: string; kind: string } | null | undefined) | undefined;

/** Turns a consumer's hit callback into the world-point observer the gesture
 *  dispatcher takes, resolving the hit with the canvas's own picker. Identity
 *  changes only between wired and not, so the dispatcher isn't rebuilt per
 *  render. */
export function useHitObserver(
  cb: ((hit: SceneCanvasHit | null) => void) | undefined,
  pickerRef: MutableRefObject<Picker>,
): ((world: { x: number; y: number }) => void) | undefined {
  const cbRef = useLatest(cb);
  const wired = Boolean(cb);
  return useMemo(() => {
    if (!wired) return undefined;
    return (world) => {
      const result = pickerRef.current?.(world.x, world.y);
      cbRef.current?.(result ? { id: result.id, kind: result.kind } : null);
    };
  }, [wired, cbRef, pickerRef]);
}
