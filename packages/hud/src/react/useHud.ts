import { useEffect, useMemo, useState } from 'react';
import { useThemeOptional } from '@weasel-js/theme/react';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createHud, type Hud } from '../hud';
import { attachHud } from '../attach';
import type { CanvasExtensionApi, Contribution } from '@weasel-js/core';
import { createHudContribution } from '../tool';

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

  // Follow the app's theme when there is one. Widgets are drawn into the
  // canvas, so they can't inherit the cascade — handing them the resolved
  // record is what keeps HUD chrome in step with a mode switch.
  const provided = useThemeOptional();
  const theme = useMemo(
    () => provided?.resolved ?? resolveTheme(weaselTheme, weaselTheme.defaultMode),
    [provided],
  );

  useEffect(() => {
    const api = canvasRef.current;
    if (!api) return;
    const detach = attachHud(api, hud, { theme });
    api.requestRedraw();
    return detach;
    // canvasRef.current changing during component lifetime is unusual for
    // canvas refs; treat as effectively-stable in v1. The dep on `hud` is
    // also stable (it comes from useState's initializer, never changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud, theme]);

  return hud;
}

/**
 * Memoize the HUD's input contribution — see {@link createHudContribution}
 * for how the routing works.
 *
 * It is stateless (its actions resolve the hit widget from the gesture's
 * affordance payload), so one instance serves any number of HUDs on the page.
 */
export function useHudContribution(): Contribution {
  return useMemo(() => createHudContribution(), []);
}
