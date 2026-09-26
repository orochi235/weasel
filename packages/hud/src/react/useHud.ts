import { useEffect, useMemo, useState } from 'react';
import { useThemeOptional } from '@weasel-js/theme/react';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createHud, type Hud } from '../hud';
import { attachHud, type AttachHudOptions } from '../attach';
import type { CanvasExtensionApi, SurfaceContribution } from '@weasel-js/core';
import { createHudContribution } from '../tool';

/**
 * Create a HUD, and — given the canvas's ref handle — attach it to that
 * canvas. Returns the Hud immediately (unbound); attaches in an effect after
 * the canvas ref populates. Cleans up on unmount.
 *
 * Omit the ref when the HUD installs through {@link useHudContribution}
 * instead, which attaches it as part of the canvas's `ambient` entry.
 *
 * An app that has already registered a bitmap family should say so —
 * `useHud(ref, { font: 'sans-serif' })` — or the HUD fetches its own copy of
 * the same atlas.
 */
export function useHud(
  canvasRef?: { current: CanvasExtensionApi | null },
  options: Pick<AttachHudOptions, 'font'> = {},
): Hud {
  const [hud] = useState(() => createHud());
  const attachOptions = useAttachOptions(options.font);

  useEffect(() => {
    const api = canvasRef?.current;
    if (!api) return;
    const detach = attachHud(api, hud, attachOptions);
    api.requestRedraw();
    return detach;
    // canvasRef.current changing during component lifetime is unusual for
    // canvas refs; treat as effectively-stable in v1. The dep on `hud` is
    // also stable (it comes from useState's initializer, never changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud, attachOptions]);

  return hud;
}

/** The attach options that follow the app's theme. Widgets are drawn into the
 *  canvas, so they can't inherit the cascade — handing them the resolved
 *  record is what keeps HUD chrome in step with a mode switch. */
function useAttachOptions(font: AttachHudOptions['font']): AttachHudOptions {
  const provided = useThemeOptional();
  return useMemo(() => ({
    theme: provided?.resolved ?? resolveTheme(weaselTheme),
    ...(provided ? { tones: provided } : {}),
    ...(font !== undefined ? { font } : {}),
  }), [provided, font]);
}

/**
 * The HUD's canvas entry — see {@link createHudContribution} for how the
 * routing works. Given a HUD, the entry also attaches it, so one `ambient`
 * entry installs the whole HUD:
 *
 * ```tsx
 * const hud = useHud();
 * const hudEntry = useHudContribution(hud, { font: 'sans-serif' });
 * <SceneCanvas ambient={[hudEntry]} … />
 * ```
 *
 * Without one it is input routing only, stateless (its actions resolve the hit
 * widget from the gesture's affordance payload), and one instance serves any
 * number of HUDs attached some other way.
 */
export function useHudContribution(
  hud?: Hud,
  options: Pick<AttachHudOptions, 'font'> = {},
): SurfaceContribution {
  const attachOptions = useAttachOptions(options.font);
  return useMemo(
    () => createHudContribution(hud, attachOptions),
    [hud, attachOptions],
  );
}
