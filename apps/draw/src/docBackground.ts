import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_BG_COLOR } from './docPersistence';
import type { DrawScene } from './drawDocument';

/** The `scene.doc` key holding the document's background color. Absent means white. */
export const BACKGROUND_KEY = 'draw:background';

/** The document's background color. */
export function backgroundOf(scene: Pick<DrawScene, 'doc'>): string {
  return scene.doc.get<string>(BACKGROUND_KEY) ?? DEFAULT_BG_COLOR;
}

/** Set the document's background: an undo entry of its own, or part of the batch it is called in. */
export function setBackground(scene: DrawScene, color: string): void {
  scene.batch('Background color', () => {
    scene.doc.set(BACKGROUND_KEY, color === DEFAULT_BG_COLOR ? undefined : color);
  });
}

/** The document's background, re-rendering as it changes, and its setter. */
export function useBackground(scene: DrawScene): [string, (color: string) => void] {
  const subscribe = useCallback((fn: () => void) => scene.subscribe(fn), [scene]);
  const read = useCallback(() => backgroundOf(scene), [scene]);
  const color = useSyncExternalStore(subscribe, read, read);
  const set = useCallback((next: string) => setBackground(scene, next), [scene]);
  return [color, set];
}
