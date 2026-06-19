import { useEffect, useState } from 'react';
import { createHud, type Hud } from '../hud';
import { attachHud } from '../attach';
import type { CanvasExtensionApi } from '@weasel-js/core';

/**
 * Create a HUD and attach it to a Canvas via its imperative ref handle.
 * Returns the Hud immediately (unbound); attaches in an effect after the
 * canvas ref populates. Cleans up on unmount.
 *
 * Usage:
 *   const ref = useRef<CanvasExtensionApi>(null);
 *   const hud = useHud(ref);
 *   // ... later
 *   const btn = hud.button({ ... });
 */
export function useHud(canvasRef: { current: CanvasExtensionApi | null }): Hud {
  const [hud] = useState(() => createHud());

  useEffect(() => {
    const api = canvasRef.current;
    if (!api) return;
    const detach = attachHud(api, hud);
    return detach;
    // canvasRef.current changing during component lifetime is unusual for
    // canvas refs; treat as effectively-stable in v1. The dep on `hud` is
    // also stable (it comes from useState's initializer, never changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud]);

  return hud;
}
