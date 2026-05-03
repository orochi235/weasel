/**
 * Canvas2D bridge for `Path`. `traceToContext` walks the command stream
 * and re-emits it on a `CanvasRenderingContext2D` so the consumer can
 * `fill`, `stroke`, or `clip` it however they like. Separated from the
 * render layer so it's reusable by custom layers, hit-debug overlays, etc.
 *
 * `RectPath` short-circuits to a single `rect()` call — no command-stream
 * walk, no temporary coords.
 */

import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path } from './types';

/** Walk a `Path` command stream and emit it onto a Canvas2D context (caller fills/strokes/clips). */
export function traceToContext(ctx: CanvasRenderingContext2D, path: Path): void {
  ctx.beginPath();
  if (path.kind === 'rect') {
    ctx.rect(path.x, path.y, path.width, path.height);
    return;
  }
  const { commands, coords } = path;
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M:
        ctx.moveTo(coords[ci], coords[ci + 1]);
        ci += 2;
        break;
      case PATH_L:
        ctx.lineTo(coords[ci], coords[ci + 1]);
        ci += 2;
        break;
      case PATH_C:
        ctx.bezierCurveTo(
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          coords[ci + 4], coords[ci + 5],
        );
        ci += 6;
        break;
      case PATH_Q:
        ctx.quadraticCurveTo(
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
        );
        ci += 4;
        break;
      case PATH_Z:
        ctx.closePath();
        break;
      default:
        throw new Error(`traceToContext: unknown command ${cmd}`);
    }
  }
}
