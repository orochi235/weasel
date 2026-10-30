import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';

/**
 * `path` as an even-odd fill that still draws for itself through the stencil:
 * an even-odd fill whose outlines never meet is triangulated and joins the
 * batch, so this adds a contour of no area from `path`'s first point to its
 * second coordinate pair, which touches the outline and paints nothing.
 */
export function stencilledEvenOdd(path: Omit<PolygonPath, 'fillRule'> & { fillRule?: string }): PolygonPath {
  const c = path.coords;
  const coords = new Float32Array(c.length + 4);
  coords.set(c);
  coords.set([c[0], c[1], c[2], c[3]], c.length);
  const commands = new Uint8Array(path.commands.length + 3);
  commands.set(path.commands);
  commands.set([PATH_M, PATH_L, PATH_Z], path.commands.length);
  return { ...path, commands, coords, fillRule: 'evenodd' } as PolygonPath;
}
