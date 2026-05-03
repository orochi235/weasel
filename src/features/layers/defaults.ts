/**
 * Composes a standard layer stack from named slots:
 *   1. background fill (if `background` color)
 *   2. grid (if `grid` config)
 *   3. scene (user objects + folded overlay poses)
 *   4. moveOverlay ghost (if move overlay active)
 *   5. additional custom layers
 *   6. resizeOverlay ghost (if resize overlay active)
 *   7. selection overlay (if `selection` config)
 *
 * The scene slot iterates objects, computes the effective pose for each id
 * (committed → moveOverlay → resizeOverlay), skips ids hidden by the move
 * overlay (so the ghost owns them during a drag), and calls the user's
 * `drawOne` per object. This collapses the per-demo
 * `effective = rects.map(...)` boilerplate.
 */

import type { RenderLayer } from './render';
import { createGridLayer, type GridLayerOpts } from './grid';
import { createSelectionOverlayLayer } from './selectionOverlay';
import type { MoveOverlay, ResizeOverlay } from '../../interactions/gestures/types';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scene slot — describes how to draw one committed object with its
 *  effective pose. */
export interface DefaultLayersScene<TObject extends { id: string }, TPose> {
  /** Live object list (typically read directly each frame). */
  objects: TObject[];
  /** Project an object to its committed pose. Defaults to `obj as unknown as TPose`. */
  toPose?: (obj: TObject) => TPose;
  /** Draw a single object given its effective pose. */
  drawOne: (ctx: CanvasRenderingContext2D, obj: TObject, pose: TPose) => void;
}

/** Selection overlay slot — passed through to `createSelectionOverlayLayer`. */
export interface DefaultLayersSelection<TPose> {
  ids: string[];
  poseById: (id: string) => TPose | null;
  /** Project a pose into its AABB; defaults to identity. */
  getBounds?: (pose: TPose) => Bounds;
  handles?: { size?: number };
}

export interface DefaultLayersOpts<TObject extends { id: string }, TPose> {
  /** Background fill color (drawn via a fillRect over the canvas). Omit to skip. */
  background?: string;
  /** Bounds for the background rect. Required when `background` is supplied. */
  backgroundBounds?: () => Bounds;
  /** Grid layer options. Omit to skip. */
  grid?: GridLayerOpts;
  /** Scene slot. */
  scene: DefaultLayersScene<TObject, TPose>;
  /** Optional move overlay (drives ghost rendering and hideIds). */
  moveOverlay?: MoveOverlay<TPose> | null;
  /** Optional resize overlay (drives the resize ghost). */
  resizeOverlay?: ResizeOverlay<TPose> | null;
  /** Selection overlay slot. Omit to skip. */
  selection?: DefaultLayersSelection<TPose>;
  /** Custom layers stacked between the move ghost and the resize ghost. */
  additional?: RenderLayer<unknown>[];
  /** Optional ghost opacity. Default 0.85. */
  ghostAlpha?: number;
}

function defaultIdentity<TObject, TPose>(obj: TObject): TPose {
  return obj as unknown as TPose;
}

function effectivePose<TPose>(
  id: string,
  committed: TPose,
  moveOverlay: MoveOverlay<TPose> | null | undefined,
  resizeOverlay: ResizeOverlay<TPose> | null | undefined,
): TPose {
  const moved = moveOverlay?.poses.get(id);
  if (moved !== undefined) return moved;
  if (resizeOverlay) {
    if (resizeOverlay.id === id) return resizeOverlay.currentPose;
    const leaf = resizeOverlay.leafPoses?.get(id);
    if (leaf !== undefined) return leaf;
  }
  return committed;
}

/**
 * Build a `RenderLayer[]` ready to feed straight into `runLayers`. See module
 * docstring for the layer order and overlay-folding semantics.
 */
export function defaultLayers<TObject extends { id: string }, TPose>(
  opts: DefaultLayersOpts<TObject, TPose>,
): RenderLayer<unknown>[] {
  const {
    background,
    backgroundBounds,
    grid,
    scene,
    moveOverlay,
    resizeOverlay,
    selection,
    additional,
    ghostAlpha = 0.85,
  } = opts;
  const toPose = scene.toPose ?? defaultIdentity<TObject, TPose>;

  const layers: RenderLayer<unknown>[] = [];

  // 1. Background
  if (background) {
    layers.push({
      id: 'background',
      label: 'Background',
      draw: (ctx) => {
        const b = backgroundBounds ? backgroundBounds() : null;
        ctx.save();
        ctx.fillStyle = background;
        if (b) ctx.fillRect(b.x, b.y, b.width, b.height);
        else {
          // Fall back to canvas-sized fill in identity coords; the caller
          // typically supplies backgroundBounds in world coords when needed.
          const c = ctx.canvas;
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.restore();
      },
    });
  }

  // 2. Grid
  if (grid) {
    layers.push(createGridLayer(grid));
  }

  // 3. Scene — iterate objects, fold in overlay poses, skip hideIds.
  layers.push({
    id: 'scene',
    label: 'Scene',
    draw: (ctx) => {
      const hide = moveOverlay?.hideIds?.length
        ? new Set(moveOverlay.hideIds)
        : null;
      for (const obj of scene.objects) {
        if (hide && hide.has(obj.id)) continue;
        const committed = toPose(obj);
        const pose = effectivePose(obj.id, committed, moveOverlay, resizeOverlay);
        scene.drawOne(ctx, obj, pose);
      }
    },
  });

  // 4. Move overlay ghost
  if (moveOverlay) {
    const ov = moveOverlay;
    layers.push({
      id: 'move-ghost',
      label: 'Move ghost',
      draw: (ctx) => {
        if (ov.draggedIds.length === 0) return;
        const byId = new Map(scene.objects.map((o) => [o.id, o]));
        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        for (const id of ov.draggedIds) {
          const pose = ov.poses.get(id);
          const obj = byId.get(id);
          if (!pose || !obj) continue;
          scene.drawOne(ctx, obj, pose);
        }
        ctx.restore();
      },
    });
  }

  // 5. Custom layers
  if (additional) layers.push(...additional);

  // 6. Resize overlay ghost (only when not the same id covered above by leaf
  //    fold-in; this layer's job is to make the resized rect visible in
  //    isolation when the scene-layer fold-in might be hidden elsewhere.
  //    For the typical case the scene-layer fold-in already drew the new
  //    pose, so we omit a duplicate here. Future hook-point.)

  // 7. Selection overlay
  if (selection) {
    const sel = selection;
    layers.push(
      createSelectionOverlayLayer<TPose>({
        getSelection: () => sel.ids,
        getPose: (id) => sel.poseById(id),
        getBounds: sel.getBounds,
        handles: sel.handles,
      }),
    );
  }

  return layers;
}
