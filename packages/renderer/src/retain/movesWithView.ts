import type { Paint } from '@weasel-js/paint';
import type { DrawCommand } from '../DrawCommand';
import { effectsReach } from '../effects/types';

const withView = new WeakMap<readonly DrawCommand[], boolean>();
const withoutView = new WeakMap<readonly DrawCommand[], boolean>();

/**
 * Whether `cmds`, drawn under a transform that only translates by a whole
 * number of device pixels, paint their old pixels moved by that much: what
 * lets a retained surface stand in for them through a pan.
 *
 * Not so for a custom shader, whose `bounds` are screen pixels; a paint in
 * screen units, the default, or in world units with no view matrix to follow;
 * a texture paint on text, which renders into a scratch buffer clamped to the
 * drawing buffer; and a group whose effects do not say how far they reach,
 * which run over the drawing buffer wherever its surface lies. Memoized by
 * array.
 */
export function movesWithView(cmds: readonly DrawCommand[], hasViewMatrix: boolean): boolean {
  const memo = hasViewMatrix ? withView : withoutView;
  const known = memo.get(cmds);
  if (known !== undefined) return known;
  const moves = cmds.every((cmd) => commandMoves(cmd, hasViewMatrix));
  memo.set(cmds, moves);
  return moves;
}

function commandMoves(cmd: DrawCommand, hasViewMatrix: boolean): boolean {
  switch (cmd.kind) {
    case 'group':
      if (cmd.effects && cmd.effects.length > 0 && !Number.isFinite(effectsReach(cmd.effects))) return false;
      return movesWithView(cmd.children, hasViewMatrix);
    case 'path':
      return paintMoves(cmd.fill?.paint, hasViewMatrix) && paintMoves(cmd.stroke?.paint, hasViewMatrix);
    case 'text':
      return cmd.runs.every((run) =>
        paintMoves(run.fill?.paint, hasViewMatrix, true) && paintMoves(run.stroke?.paint, hasViewMatrix, true));
    case 'image':
    case 'sprites':
      return true;
    case 'shader':
      return false;
  }
}

function paintMoves(paint: Paint | undefined, hasViewMatrix: boolean, onGlyphs = false): boolean {
  if (!paint || paint.kind === undefined || paint.kind === 'solid') return true;
  if (onGlyphs && paint.kind === 'texture') return false;
  const units = 'units' in paint ? paint.units : undefined;
  return units === 'local' || (units === 'world' && hasViewMatrix);
}
