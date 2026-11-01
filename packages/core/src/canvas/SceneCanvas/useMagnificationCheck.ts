import { useEffect } from 'react';
import { isDev } from '@weasel-js/registry';
import type { Scene } from 'core/scene/types';
import { undeclaredMagnifications } from 'interactions/actions/magnification';

const SETTLE_MS = 250;
const times = (n: number): string => `${Number(n.toFixed(3))}×`;

/**
 * In development, warns once per container and size when `scene` draws a
 * container's children at a magnification its unit scopes do not declare in
 * `drawnAt`: what silently turned a 20″ cabinet into 30″ of board. Checks
 * after edits settle rather than on every frame of a drag.
 */
export function useMagnificationCheck(scene: Scene<unknown, string, unknown>): void {
  useEffect(() => {
    if (!isDev()) return;
    const warned = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = (): void => {
      timer = null;
      for (const { id, drawn, declared } of undeclaredMagnifications(scene)) {
        const size = drawn.x === drawn.y ? times(drawn.x) : `${times(drawn.x)} by ${times(drawn.y)}`;
        const key = `${id}:${size}:${declared}`;
        if (warned.has(key)) continue;
        warned.add(key);
        console.warn(
          `weasel: node "${id}" draws its children at ${size}, but its unit scopes declare ${times(declared)}. `
          + 'Set `units.drawnAt` on the node whose transform scales them, or correct the transform.',
        );
      }
    };
    check();
    const unsubscribe = scene.subscribe(() => {
      timer ??= setTimeout(check, SETTLE_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [scene]);
}
