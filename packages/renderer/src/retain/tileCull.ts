import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { isOwnComposite } from '../effects/compositeOp';
import { contentBox, type DeviceBox, type DeviceRect } from './contentBounds';

/** The device boxes of a list of commands, and of the children of each group
 *  among them that a tile may draw only part of. */
export interface BoxTree {
  cmds: readonly DrawCommand[];
  boxes: DeviceBox[];
  inner: (BoxTree | null)[];
}

/** A group drawn whole or not at all: its effects or isolation read
 *  everything in it, and its own composite changes the destination even
 *  where it drew nothing. */
function whole(cmd: GroupDrawCommand): boolean {
  return (cmd.effects !== undefined && cmd.effects.length > 0) || cmd.isolate === true || isOwnComposite(cmd.composite);
}

/** `cmds` drawn under `transform`, boxed in device pixels at `scale`, every
 *  leaf once. A group's clip is left out of its box, which can only keep more. */
export function boxTree(cmds: readonly DrawCommand[], transform: GlMat3, scale: number): BoxTree {
  const boxes: DeviceBox[] = [];
  const inner: (BoxTree | null)[] = [];
  for (const cmd of cmds) {
    if (cmd.kind !== 'group' || whole(cmd)) {
      boxes.push(contentBox([cmd], transform, [], scale));
      inner.push(null);
      continue;
    }
    const sub = boxTree(cmd.children, cmd.transform ? mat3.multiply(transform, cmd.transform) : transform, scale);
    let box: DeviceBox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const b of sub.boxes) {
      box = { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) };
    }
    boxes.push(box);
    inner.push(sub);
  }
  return { cmds, boxes, inner };
}

/** `tree`'s commands without those whose box misses `tile`, at any depth; a
 *  group left with no children goes too. `tree.cmds` itself when none goes. */
export function cullToTile(tree: BoxTree, tile: DeviceRect): readonly DrawCommand[] {
  const { cmds, boxes, inner } = tree;
  let out: DrawCommand[] | null = null;
  for (let i = 0; i < cmds.length; i++) {
    let cmd = cmds[i];
    const sub = inner[i];
    let keep = boxMeets(boxes[i], tile);
    if (keep && sub) {
      const children = cullToTile(sub, tile);
      if (children.length === 0) keep = false;
      else if (children !== sub.cmds) cmd = { ...(cmd as GroupDrawCommand), children: children as DrawCommand[] };
    }
    if (keep && cmd === cmds[i]) {
      out?.push(cmd);
      continue;
    }
    out ??= cmds.slice(0, i);
    if (keep) out.push(cmd);
  }
  return out ?? cmds;
}

function boxMeets(box: DeviceBox, rect: DeviceRect): boolean {
  return box.x0 < rect.x + rect.width && box.x1 > rect.x && box.y0 < rect.y + rect.height && box.y1 > rect.y;
}
