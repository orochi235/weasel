import { remapPerAnchor, resolveCornersWithSources } from '@weasel-js/geom';
import type { PathDrawCommand } from '../DrawCommand';

/** The ribbon cache compares `vertexWidths` by reference, so a remapped copy
 *  has to be the same array on every frame its source array and the corner
 *  expansion (cached per path) are. */
const REMAPPED = new WeakMap<readonly unknown[], WeakMap<Uint32Array, unknown[]>>();

function remapped<T>(values: readonly T[], sources: Uint32Array, stride: number): T[] {
  let bySources = REMAPPED.get(values);
  if (bySources === undefined) {
    bySources = new WeakMap();
    REMAPPED.set(values, bySources);
  }
  let out = bySources.get(sources) as T[] | undefined;
  if (out === undefined) {
    out = remapPerAnchor(values, sources, stride);
    bySources.set(sources, out);
  }
  return out;
}

/** `cmd` with its path's corner shapes expanded, and its per-anchor colors
 *  and widths carried onto the anchors the expansion leaves. */
export function withCornersResolved(cmd: PathDrawCommand): PathDrawCommand {
  if (cmd.path.kind !== 'polygon') return cmd;
  const { path, anchorSources: src } = resolveCornersWithSources(cmd.path);
  if (path === cmd.path) return cmd;
  const out: PathDrawCommand = { ...cmd, path };
  if (src && cmd.vertexColors) out.vertexColors = remapped(cmd.vertexColors, src, 4);
  if (src && cmd.stroke && (cmd.stroke.vertexColors || cmd.stroke.vertexWidths)) {
    const { vertexColors, vertexWidths } = cmd.stroke;
    out.stroke = {
      ...cmd.stroke,
      ...(vertexColors ? { vertexColors: remapped(vertexColors, src, 4) } : {}),
      ...(vertexWidths ? { vertexWidths: remapped(vertexWidths, src, 1) } : {}),
    };
  }
  return out;
}
