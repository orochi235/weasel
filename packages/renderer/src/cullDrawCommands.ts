import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from './DrawCommand';
import { isOwnComposite } from './effects/compositeOp';
import { commandBox, paintedBox, screenBox, type ScreenBox } from './paintedBounds';

/** A screen-space rectangle, CSS pixels. */
export interface CullRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Screen pixels added to every bound: antialiasing, and the 1/8 px a `{ px }`
 *  stroke's width may drift through quantization. */
export const CULL_SLACK_PX = 1;

/**
 * `cmds` without the commands that cannot put a pixel inside `rect`, where
 * `transform` maps the commands' space to screen space — `viewToMat3(view)`
 * for a world-space layer — and `dpr` is the device pixels to the screen
 * pixel the commands will be drawn at.
 *
 * Conservative by construction: a command is dropped only when a bound that
 * encloses everything it can paint misses `rect`. Paths are bounded by their
 * control hull plus the farthest a stroke can reach (miter spikes and square
 * caps included), images and sprites by their quads, and every bound is taken
 * through the accumulated transform as the AABB of its corners, so rotation
 * only enlarges it. Text and shader commands are always kept, and so is a
 * group with its own `composite`, which changes the destination even where
 * the group drew nothing. A group with `effects` is kept or dropped whole, by
 * its children's bound grown by how far the effects reach (`effectsReach`, in
 * device pixels, so `dpr` converts it) and cut by its clip; one whose effects
 * do not say how far they reach is always kept. Other clips are ignored, which
 * can only keep more. A group whose children all go is dropped.
 *
 * Returns `cmds` itself when nothing was dropped.
 */
export function cullDrawCommands(
  cmds: DrawCommand[],
  transform: GlMat3,
  rect: CullRect,
  dpr: number,
): DrawCommand[] {
  return cullList(cmds, transform, slackBox(rect), dpr);
}

type Box = ScreenBox;

function cullList(cmds: DrawCommand[], m: GlMat3, box: Box, dpr: number): DrawCommand[] {
  let out: DrawCommand[] | null = null;
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    const kept = cullOne(cmd, m, box, dpr);
    if (kept === cmd) {
      out?.push(cmd);
      continue;
    }
    out ??= cmds.slice(0, i);
    if (kept) out.push(kept);
  }
  return out ?? cmds;
}

function cullOne(cmd: DrawCommand, m: GlMat3, box: Box, dpr: number): DrawCommand | null {
  switch (cmd.kind) {
    case 'group': {
      if (isOwnComposite(cmd.composite)) return cmd;
      if (cmd.effects && cmd.effects.length > 0) return boxMisses(commandBox(cmd, m, dpr), box) ? null : cmd;
      const inner = cmd.transform ? mat3.multiply(m, cmd.transform) : m;
      const children = cullList(cmd.children, inner, box, dpr);
      if (children === cmd.children) return cmd;
      return children.length === 0 ? null : { ...cmd, children };
    }
    case 'path':
    case 'image':
    case 'sprites':
      return boxMisses(paintedBox(cmd, m), box) ? null : cmd;
    default:
      return cmd;
  }
}

/**
 * True when `bounds`, taken through `transform` to screen space, cannot put a
 * pixel inside `rect` — the per-command test above, for a caller holding a box
 * rather than a command. Same slack, same NaN-keeps rule.
 */
export function boundsMissRect(
  bounds: { x: number; y: number; width: number; height: number },
  transform: GlMat3,
  rect: CullRect,
): boolean {
  const x0 = Math.min(bounds.x, bounds.x + bounds.width);
  const x1 = Math.max(bounds.x, bounds.x + bounds.width);
  const y0 = Math.min(bounds.y, bounds.y + bounds.height);
  const y1 = Math.max(bounds.y, bounds.y + bounds.height);
  return boxMisses(screenBox(x0, y0, x1, y1, transform), slackBox(rect));
}

function slackBox(rect: CullRect): Box {
  return {
    minX: rect.x - CULL_SLACK_PX,
    minY: rect.y - CULL_SLACK_PX,
    maxX: rect.x + rect.width + CULL_SLACK_PX,
    maxY: rect.y + rect.height + CULL_SLACK_PX,
  };
}

/** True when `b` lies wholly outside `box`. Any NaN makes every comparison
 *  false, so the command is kept; so does a `null` bound. */
function boxMisses(b: ScreenBox | null, box: Box): boolean {
  return b !== null && (b.maxX < box.minX || b.minX > box.maxX || b.maxY < box.minY || b.minY > box.maxY);
}
