import { MAX_EVENODD_RESOLVE_WORK } from '@weasel-js/geom/tessellate';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';

/** Edges in the added contour: enough that resolving the fill would pass
 *  the tessellator's budget. */
const PADDING = Math.ceil(Math.sqrt(MAX_EVENODD_RESOLVE_WORK)) + 1;

/**
 * `path` as an even-odd fill that still draws for itself through the stencil.
 * An even-odd fill is triangulated and joins the batch unless resolving its
 * crossings would cost too much, so this adds a contour of no area running
 * back and forth along `path`'s first edge, which touches the outline, paints
 * nothing, and holds enough edges to put the fill past that budget.
 */
export function stencilledEvenOdd(path: Omit<PolygonPath, 'fillRule'> & { fillRule?: string }): PolygonPath {
  const c = path.coords;
  const coords = new Float32Array(c.length + (PADDING + 1) * 2);
  coords.set(c);
  for (let k = 0; k <= PADDING; k++) coords.set(k % 2 ? [c[2], c[3]] : [c[0], c[1]], c.length + k * 2);
  const commands = new Uint8Array(path.commands.length + PADDING + 2);
  commands.set(path.commands);
  commands[path.commands.length] = PATH_M;
  commands.fill(PATH_L, path.commands.length + 1, path.commands.length + 1 + PADDING);
  commands[commands.length - 1] = PATH_Z;
  return { ...path, commands, coords, fillRule: 'evenodd' } as PolygonPath;
}
