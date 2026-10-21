import { effectivePose, type View } from '@weasel-js/core';
import type { LoupeRect } from '@weasel-js/loupe';
import type { LensScene } from './lensTypes';

/** How far a selected body's box reaches past it on every side, in px: enough
 *  that its transform handles, which straddle the edge, still take a press. */
export const HANDLE_SLOP = 12;

/** One element of the lens canvas that takes input: a press on it reaches the
 *  lens's dispatcher, and a press anywhere else falls through to the trials. */
export interface LensHitBox {
  nodeId: string;
  role: 'lens-body' | 'lens-reticle';
  /** In the px of the layer the lens canvas covers. */
  rect: LoupeRect;
  round: boolean;
}

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Every body and reticle's box, through `view`, in paint order. Leaders take
 *  no input, so they get none. */
export function hitBoxesOf<C>(
  scene: LensScene<C>,
  selected: ReadonlySet<string>,
  view: View = IDENTITY,
): readonly LensHitBox[] {
  const out: LensHitBox[] = [];
  for (const node of scene.renderOrderNodes()) {
    const { data } = node;
    if (data.role === 'lens-leader') continue;
    const p = effectivePose(scene, node);
    let rect: LoupeRect = {
      x: (p.x - view.x) * view.scale.x,
      y: (p.y - view.y) * view.scale.y,
      w: p.width * view.scale.x,
      h: p.height * view.scale.y,
    };
    const body = data.role === 'lens-body';
    const grown = body && selected.has(node.id);
    if (grown) {
      rect = {
        x: rect.x - HANDLE_SLOP,
        y: rect.y - HANDLE_SLOP,
        w: rect.w + 2 * HANDLE_SLOP,
        h: rect.h + 2 * HANDLE_SLOP,
      };
    }
    // A selected body's handles sit on its bounding box's corners, outside a
    // round body, so its box goes square to keep them reachable.
    const round = body ? !grown && data.shape === 'circle' : true;
    out.push({ nodeId: node.id, role: data.role, rect, round });
  }
  return out;
}
