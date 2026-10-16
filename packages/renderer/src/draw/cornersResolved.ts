import { remapPerAnchor, resolveCornersWithSources } from '@weasel-js/geom';
import type { PathDrawCommand } from '../DrawCommand';

/** `cmd` with its path's corner shapes expanded, and its per-anchor colors
 *  and widths carried onto the anchors the expansion leaves. */
export function withCornersResolved(cmd: PathDrawCommand): PathDrawCommand {
  if (cmd.path.kind !== 'polygon') return cmd;
  const { path, anchorSources: src } = resolveCornersWithSources(cmd.path);
  if (path === cmd.path) return cmd;
  const out: PathDrawCommand = { ...cmd, path };
  if (src && cmd.vertexColors) out.vertexColors = remapPerAnchor(cmd.vertexColors, src, 4);
  if (src && cmd.stroke && (cmd.stroke.vertexColors || cmd.stroke.vertexWidths)) {
    const { vertexColors, vertexWidths } = cmd.stroke;
    out.stroke = {
      ...cmd.stroke,
      ...(vertexColors ? { vertexColors: remapPerAnchor(vertexColors, src, 4) } : {}),
      ...(vertexWidths ? { vertexWidths: remapPerAnchor(vertexWidths, src, 1) } : {}),
    };
  }
  return out;
}
