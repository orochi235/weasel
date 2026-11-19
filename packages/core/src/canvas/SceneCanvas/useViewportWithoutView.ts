import { useEffect } from 'react';
import { isDev } from '@weasel-js/react';
import type { EnabledPresets } from './features';
import type { SceneCanvasViewport } from './viewportProp';

/** Warns, in development, when `viewport` configures navigation no preset turns on. */
export function useViewportWithoutView(viewport: SceneCanvasViewport | undefined, enabled: EnabledPresets): void {
  // `recenter` reaches the view dep with or without corePresets.view, so it alone is never unread.
  const unread = viewport !== undefined && !enabled.has('view')
    && Object.entries(viewport).some(([key, value]) => key !== 'recenter' && value !== undefined);
  useEffect(() => {
    if (unread && isDev()) {
      console.warn('[SceneCanvas] `viewport` configures the view preset (`view`, from @weasel-js/core/presets), which is not in `features`: wheel, pinch, and the zoom keys do nothing.');
    }
  }, [unread]);
}
