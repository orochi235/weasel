import {
  isPaintKindKnown, warmFonts, warmPaintKinds, type FontRequest, type RenderNeeds,
} from '@weasel-js/core';
import type { SvgNode } from './types';
import { PaintServerRegistry } from './gradients';
import { registerPaintServers, scriptSizeFace } from './serialize';

/**
 * What `serializeSvg(nodes)` reads that loads on demand: the paint kind of
 * every fill and stroke it writes as a paint server, and the face of every
 * run whose script size it takes from font metrics. The kinds come from the
 * serializer's own paint pre-pass, so the two cannot disagree. Registered
 * kinds are included.
 */
export function svgNeeds(nodes: readonly SvgNode[]): RenderNeeds {
  const registry = new PaintServerRegistry();
  registerPaintServers(nodes, registry);
  const fonts = new Map<string, FontRequest>();
  const walk = (list: readonly SvgNode[]) => {
    for (const n of list) {
      if (n.kind === 'group') walk(n.children);
      else if (n.kind === 'text') {
        for (const run of n.runs ?? []) {
          const face = scriptSizeFace(run, n.style);
          if (face) fonts.set(`${face.family}|${face.weight}|${face.style}`, face);
        }
      }
    }
  };
  walk(nodes);
  return { fonts: [...fonts.values()], paintKinds: registry.paintKinds() };
}

/**
 * Load what {@link svgNeeds} lists, so a `serializeSvg(nodes)` issued after it
 * resolves writes every paint server's def and every script size from the
 * face it renders in. Only those load: a lazily registered kind or font the
 * nodes do not use is never fetched, and cannot fail the export. A kind
 * nothing registered is passed over; the export warns about it instead.
 */
export function warmSvg(nodes: readonly SvgNode[]): Promise<void> {
  const needs = svgNeeds(nodes);
  return Promise.all([
    warmFonts(needs.fonts),
    warmPaintKinds(needs.paintKinds.filter(isPaintKindKnown)),
  ]).then(() => undefined);
}
