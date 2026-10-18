/**
 * `usePreviewPathsDepSource` — wires the `previewPaths` dep: where an
 * action's `preview` draws what it would make, over this canvas.
 */
import { useMemo } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { createPathOverlay, type TransientPath } from 'canvas/pathOverlay';
import type { CanvasExtensionApi } from '../canvasExtension';

/** Paths drawn over the canvas until the function `show` returns is called.
 *  A later `show` replaces what an earlier one drew, and the earlier one's
 *  function then takes nothing down. */
export interface PreviewPathsDep {
  show(paths: readonly TransientPath[]): () => void;
}

/** The layer id the previewed paths are drawn on. */
export const PREVIEW_PATHS_LAYER_ID = 'weasel-action-preview';

/** A {@link PreviewPathsDep} drawing on the canvas `api` answers, its layer
 *  attached only while something is shown. */
export function createPreviewPaths(api: () => CanvasExtensionApi | null): PreviewPathsDep {
  const overlay = createPathOverlay({ id: PREVIEW_PATHS_LAYER_ID, label: 'Action preview' });
  let detach: (() => void) | null = null;
  let current = 0;
  return {
    show(paths) {
      const canvas = api();
      if (!canvas) return () => {};
      const mine = ++current;
      overlay.set(paths);
      if (!detach) detach = canvas.registerLayer(overlay.layer);
      canvas.requestRedraw();
      return () => {
        if (mine !== current) return;
        overlay.clear();
        detach?.();
        detach = null;
        canvas.requestRedraw();
      };
    },
  };
}

export function usePreviewPathsDepSource(canvasApiRef: React.RefObject<CanvasExtensionApi | null>): void {
  const dep = useMemo(() => createPreviewPaths(() => canvasApiRef.current), [canvasApiRef]);
  useDepSource('previewPaths', () => dep);
}
