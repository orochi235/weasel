import {
  isPaintKindKnown, resolveRunFace, resolveTextStyle, toRuns, warmFonts, warmPaintKinds,
  type FontRequest, type RenderNeeds,
} from '@weasel-js/core';
import type { SerializeOptions, SvgNode, SvgTextNode } from './types';
import { PaintServerRegistry } from './gradients';
import { registerPaintServers } from './serialize';
import { scriptSizeFace } from './serializeText';

/**
 * What `serializeSvg(nodes)` reads that loads on demand: the paint kind of
 * every fill and stroke it writes as a paint server, and the face of every
 * run whose script size it takes from font metrics. The kinds come from the
 * serializer's own paint pre-pass, so the two cannot disagree. Registered
 * kinds are included. Given the `textLayout` the export will run, every face
 * a text node is set in, which that layout measures with.
 */
export function svgNeeds(
  nodes: readonly SvgNode[], opts: Pick<SerializeOptions, 'textLayout'> = {},
): RenderNeeds {
  const registry = new PaintServerRegistry();
  registerPaintServers(nodes, registry);
  const fonts = new Map<string, FontRequest>();
  const add = (face: Required<FontRequest>) => fonts.set(`${face.family}|${face.weight}|${face.style}`, face);
  const walk = (list: readonly SvgNode[]) => {
    for (const n of list) {
      if (n.kind === 'group') walk(n.children);
      else if (n.kind === 'text') {
        if (opts.textLayout) layoutFaces(n).forEach(add);
        for (const run of n.runs ?? []) {
          const face = scriptSizeFace(run, n.style);
          if (face) add(face);
        }
      }
    }
  };
  walk(nodes);
  return { fonts: [...fonts.values()], paintKinds: registry.paintKinds() };
}

/** The face each of `node`'s runs is set in. */
function layoutFaces(node: SvgTextNode): Required<FontRequest>[] {
  const style = resolveTextStyle(node.style);
  return toRuns(node.runs && node.runs.length > 0 ? node.runs : node.text).map((run) => {
    const face = resolveRunFace(run, style);
    return { family: face.fontFamily, weight: face.fontWeight, style: face.fontStyle };
  });
}

/**
 * Load what {@link svgNeeds} lists, so a `serializeSvg(nodes, opts)` issued
 * after it resolves writes every paint server's def, and every script size and
 * laid-out line from the face it renders in. Only those load: a lazily registered kind or font the
 * nodes do not use is never fetched, and cannot fail the export. A kind
 * nothing registered is passed over; the export warns about it instead.
 */
export function warmSvg(
  nodes: readonly SvgNode[], opts: Pick<SerializeOptions, 'textLayout'> = {},
): Promise<void> {
  const needs = svgNeeds(nodes, opts);
  return Promise.all([
    warmFonts(needs.fonts),
    warmPaintKinds(needs.paintKinds.filter(isPaintKindKnown)),
  ]).then(() => undefined);
}
