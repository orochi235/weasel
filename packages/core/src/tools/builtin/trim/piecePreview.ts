import { createEmitter } from '@weasel-js/registry';
import { transformPath, type PolygonPath } from '@weasel-js/geom';
import type { RenderLayer } from 'core/layers/render';
import type { Scene } from 'core/scene/types';
import { viewToTransform } from 'core/viewport/view';
import { OVERLAY_ROLE_STROKES } from 'canvas/overlayRoleStrokes';

/** A piece of a stroke shown before it is cut away, and the scene it was
 *  measured on. */
export interface PiecePreviewState {
  path: PolygonPath;
  scene: Pick<Scene<unknown, string, unknown>, 'getVersion'>;
}

/**
 * The highlight a tool draws over the piece of a stroke a click would cut:
 * `show` sets it, and the screen-space `layer` paints it in the `cut` role's
 * stroke. A piece measured before the scene last changed is not drawn, so a
 * commit retires its own preview without being told.
 */
export function createPiecePreview(): {
  show(next: PiecePreviewState | null): void;
  current(): PiecePreviewState | null;
  layer: RenderLayer<unknown>;
} {
  const changed = createEmitter();
  let state: { piece: PiecePreviewState; version: number } | null = null;
  const current = () => (state && state.piece.scene.getVersion() === state.version ? state.piece : null);
  return {
    show(next) {
      if (!next && !state) return;
      if (next && state && next.path === state.piece.path) return;
      state = next ? { piece: next, version: next.scene.getVersion() } : null;
      changed.emit();
    },
    current,
    layer: {
      id: 'stroke-piece-preview',
      label: 'Piece a click would cut',
      space: 'screen',
      subscribe: (repaint) => changed.subscribe(repaint),
      draw: (_data, view) => {
        const piece = current();
        if (!piece) return [];
        const t = viewToTransform(view);
        const stroke = { ...OVERLAY_ROLE_STROKES['cut'], width: 3 };
        return [{ kind: 'path', path: transformPath(piece.path, [t.zoom.x, 0, 0, t.zoom.y, t.panX, t.panY]), stroke }];
      },
    },
  };
}
