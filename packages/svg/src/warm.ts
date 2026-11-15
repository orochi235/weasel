import {
  isPaintKindKnown, loadTextOutlines, warmFonts, warmPaintKinds, type FontRequest, type RenderDiagnostic, type RenderDiagnosticSink,
  type RenderNeeds,
} from '@weasel-js/core';
import type { SerializeOptions, SvgNode, SvgTextNode } from './types';
import { PaintServerRegistry } from './gradients';
import { registerPaintServers } from './serialize';
import { scriptSizeFace } from './serializeText';
import { requestedFaces } from './textModes';

/**
 * What `serializeSvg(nodes)` reads that loads on demand: the paint kind of
 * every fill and stroke it writes as a paint server, and the face of every
 * run whose script size it takes from font metrics. The kinds come from the
 * serializer's own paint pre-pass, so the two cannot disagree. Registered
 * kinds are included. Given the `textLayout` the export will run, every face
 * a text node is set in, which that layout measures with; so too under a
 * `text` mode other than `'live'`, which outlines or embeds those faces, and
 * for a node that shrinks to fit, which is measured to find its size.
 */
export function svgNeeds(nodes: readonly SvgNode[], opts: Pick<SerializeOptions, 'textLayout' | 'text'> = {}): RenderNeeds {
  const registry = new PaintServerRegistry();
  registerPaintServers(nodes, registry);
  const fonts = new Map<string, FontRequest>();
  const add = (face: Required<FontRequest>) => fonts.set(`${face.family}|${face.weight}|${face.style}`, face);
  const walk = (list: readonly SvgNode[]) => {
    for (const n of list) {
      if (n.kind === 'group') walk(n.children);
      else if (n.kind === 'text') {
        if (opts.textLayout || readsOutlines(opts) || n.fit === 'shrink') requestedFaces(n).forEach(add);
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

const readsOutlines = (opts: Pick<SerializeOptions, 'textLayout' | 'text'>): boolean => (opts.text ?? 'live') !== 'live';

/** Every text node in `nodes`, through groups. */
function textNodes(nodes: readonly SvgNode[], out: SvgTextNode[] = []): SvgTextNode[] {
  for (const n of nodes) {
    if (n.kind === 'group') textNodes(n.children, out);
    else if (n.kind === 'text') out.push(n);
  }
  return out;
}

/**
 * Load what {@link svgNeeds} lists, so a `serializeSvg(nodes, opts)` issued
 * after it resolves writes every paint server's def, and every script size and
 * laid-out line from the face it renders in, and under a `text` mode other
 * than `'live'` the outlines of every face text is set in. Only those load: a lazily registered kind or font the
 * nodes do not use is never fetched, and cannot fail the export. A kind
 * nothing registered is passed over; the export warns about it instead.
 * Given `report`, a load that fails is reported there, and the rest still
 * load, rather than rejecting.
 */
export function warmSvg(
  nodes: readonly SvgNode[], opts: Pick<SerializeOptions, 'textLayout' | 'text'> = {}, report?: RenderDiagnosticSink,
): Promise<void> {
  const needs = svgNeeds(nodes, opts);
  const kinds = needs.paintKinds.filter(isPaintKindKnown);
  const outlines = readsOutlines(opts) ? textNodes(nodes) : [];
  if (!report) {
    return Promise.all([warmFonts(needs.fonts), warmPaintKinds(kinds), ...outlines.map((n) => loadTextOutlines(n))]).then(() => undefined);
  }
  const loads: { load: () => Promise<unknown>; lost: (err: unknown) => RenderDiagnostic }[] = [
    ...needs.fonts.map((f) => ({ load: () => warmFonts([f]), lost: (err: unknown) => fontLost(f.family, err) })),
    ...kinds.map((k) => ({
      load: () => warmPaintKinds([k]),
      lost: (err: unknown) => ({ kind: 'paint-kind' as const, subject: k, message: `the paint kind "${k}" did not load (${String(err)}); what it paints is left out` }),
    })),
    ...outlines.map((n) => ({ load: () => loadTextOutlines(n), lost: (err: unknown) => fontLost(n.style?.fontFamily ?? 'a text face', err) })),
  ];
  return Promise.allSettled(loads.map((l) => l.load())).then((results) => {
    results.forEach((r, i) => { if (r.status === 'rejected') report(loads[i]!.lost(r.reason)); });
  });
}

const fontLost = (family: string, err: unknown): RenderDiagnostic =>
  ({ kind: 'font', subject: family, message: `the font ${family} did not load (${String(err)}); its text is written without it` });
