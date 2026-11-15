import { useEffect } from 'react';
import { isDev } from '@weasel-js/react';
import type { EnabledPresets } from './features';
import type { SceneCanvasViewport } from './viewportProp';

/** Warns, in development, when `viewport` configures navigation no preset turns on. */
export function useViewportWithoutView(viewport: SceneCanvasViewport | undefined, enabled: EnabledPresets): void {
  const unread = viewport !== undefined && !enabled.has('view');
  useEffect(() => {
    if (unread && isDev()) {
      console.warn('[SceneCanvas] `viewport` configures viewPreset, which is not in `features`: wheel, pinch, and the zoom keys do nothing.');
    }
  }, [unread]);
}
