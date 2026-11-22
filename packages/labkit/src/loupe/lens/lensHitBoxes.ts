import { effectivePose, type View, viewRectToScreen } from '@weasel-js/core';
import type { LoupeRect } from '@weasel-js/loupe';
import { SEAM_GRAB, type SeamPreview, seamOf, showsSeam, splitRects } from './compare';
import { lensShapeOf, settingsOf } from './lensScene';
import type { LensScene } from './lensTypes';

/** How far a selected body's box reaches past it on every side, in px: enough
 *  that its transform handles, which straddle the edge, still take a press. */
export const HANDLE_SLOP = 12;

/** One element of the lens canvas that takes input: a press on it reaches the
 *  lens's dispatcher, and a press anywhere else falls through to the trials. */
export interface LensHitBox {
  nodeId: string;
  role: 'lens-body' | 'lens-reticle' | 'lens-seam';
  /** In the px of the layer the lens canvas covers. */
  rect: LoupeRect;
  round: boolean;
}

/** A body's own rect, given its hit box: without the slop it grows by while selected. */
export function interiorOf(rect: LoupeRect, grown: boolean): LoupeRect {
  if (!grown) return rect;
  return {
    x: rect.x + HANDLE_SLOP,
    y: rect.y + HANDLE_SLOP,
    width: rect.width - 2 * HANDLE_SLOP,
    height: rect.height - 2 * HANDLE_SLOP,
  };
}

/** The strip SEAM_GRAB either side of a seam at `seamX`, as tall as the interior is there: a round lens's seam is
 *  clipped to the circle, so the strip stops where the lens does. */
function seamBox(interior: LoupeRect, seamX: number, round: boolean): LoupeRect {
  const x = seamX - SEAM_GRAB;
  const width = 2 * SEAM_GRAB;
  if (!round) return { x, y: interior.y, width, height: interior.height };
  const rx = interior.width / 2;
  const ry = interior.height / 2;
  const cx = interior.x + rx;
  const dx = Math.max(0, Math.abs(cx - seamX) - SEAM_GRAB);
  const half = rx > 0 ? ry * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2)) : 0;
  return { x, y: interior.y + ry - half, width, height: 2 * half };
}

/** Whether a box takes a press at `(x, y)`, in its own px: a round box only inside its ellipse, as it is drawn. */
export function boxContains(box: LensHitBox, x: number, y: number): boolean {
  const { rect } = box;
  if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) return false;
  if (!box.round) return true;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  return ((x - rect.x - rx) / rx) ** 2 + ((y - rect.y - ry) / ry) ** 2 <= 1;
}

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Every body and reticle's box, through `view`, in paint order, with a split
 *  body's seam above it. Leaders and Glass reticles take no input, so they get none. */
export function hitBoxesOf<C>(
  scene: LensScene<C>,
  selected: ReadonlySet<string>,
  view: View = IDENTITY,
  preview?: SeamPreview,
): readonly LensHitBox[] {
  const out: LensHitBox[] = [];
  for (const node of scene.renderOrderNodes()) {
    const { data } = node;
    if (data.role === 'lens-leader') continue;
    // A Glass reticle is the patch under its own body: it is not shown, and the body takes the pointer there.
    if (data.role === 'lens-reticle' && settingsOf(scene, data.lensId)?.aim === 'glass') continue;
    const p = effectivePose(scene, node);
    let rect: LoupeRect = viewRectToScreen(view, p);
    const body = data.role === 'lens-body';
    const grown = body && selected.has(node.id);
    if (grown) {
      rect = {
        x: rect.x - HANDLE_SLOP,
        y: rect.y - HANDLE_SLOP,
        width: rect.width + 2 * HANDLE_SLOP,
        height: rect.height + 2 * HANDLE_SLOP,
      };
    }
    // A selected body's handles sit on its bounding box's corners, outside a
    // round body, so its box goes square to keep them reachable.
    const round = body
      ? !grown && data.shape === 'circle'
      : lensShapeOf(scene, data.lensId) !== 'square';
    out.push({ nodeId: node.id, role: data.role, rect, round });
    if (body && showsSeam(data)) {
      const interior = interiorOf(rect, grown);
      const { seamX } = splitRects(interior, seamOf(data, preview, data.lensId));
      const strip = seamBox(interior, seamX, data.shape === 'circle');
      out.push({ nodeId: node.id, role: 'lens-seam', rect: strip, round: false });
    }
  }
  return out;
}
