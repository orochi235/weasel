/**
 * Broken constraint links, drawn wherever the nodes are, path edit or not: a
 * transform or an edit that leaves a link unable to hold shows it until it
 * holds again. Each gets its constraint's mark by the anchor it holds, as
 * path edit draws a conflict, and a dashed line from that anchor to where the
 * link wants it — the other anchor, or the nearest point of the segment —
 * both in the conflict color.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import { nearestOnCubic, PathBuilder, type ConstraintPoint, type View } from '@weasel-js/geom';
import type { CanvasExtensionApi, ContributionDepReader, RenderLayer, Scene, SurfaceContribution } from '@weasel-js/core';
import { constraintGlyphs, type ConstraintGlyphStyle } from './constraintGlyphs';
import { brokenConstraintLinks, type BrokenConstraintLink } from './constraintLinks';

type Pt = { x: number; y: number };

/** Id of the broken-link marks' layer and contribution. */
export const CONSTRAINT_LINK_MARKS_ID = 'path-tools:constraint-link-marks';

const DASH = [4, 3];

/** Where `link` wants its first anchor: its partner anchor, or the point of its segment nearest it. */
function wanted(link: BrokenConstraintLink, points: readonly ConstraintPoint[]): { from: number; to: Pt } | null {
  const c = link.constraint;
  if (c.kind === 'coincident') {
    const [a, b] = c.anchors;
    return points[a] && points[b] ? { from: a, to: points[b] } : null;
  }
  if (c.kind !== 'onPath') return null;
  const p = points[c.anchor];
  const [a, b] = c.segment.map((i) => points[i]);
  if (!p || !a || !b) return null;
  const h1 = a.outHandle ?? a;
  const h2 = b.inHandle ?? b;
  const near = nearestOnCubic(p.x, p.y, a.x, a.y, h1.x, h1.y, h2.x, h2.y, b.x, b.y);
  return { from: c.anchor, to: { x: near.x, y: near.y } };
}

/**
 * Screen-space draw commands for `links`, each drawn in `style.conflictStroke`:
 * its constraint's mark, and a dashed line from the anchor it holds to where
 * it wants it. A link with no points draws nothing.
 */
export function constraintLinkMarks(
  links: readonly BrokenConstraintLink[],
  toScreen: (p: Pt) => Pt,
  style: ConstraintGlyphStyle,
): DrawCommand[] {
  const conflict = new Set([0]);
  return links.flatMap((link) => {
    if (!link.points) return [];
    const screen = link.points.map((p) => ({
      ...p,
      ...toScreen(p),
      ...(p.inHandle ? { inHandle: toScreen(p.inHandle) } : {}),
      ...(p.outHandle ? { outHandle: toScreen(p.outHandle) } : {}),
    }));
    const out = constraintGlyphs(screen, [link.constraint], conflict, style);
    const want = wanted(link, screen);
    if (want) {
      const from = screen[want.from];
      const path = new PathBuilder().moveTo(from.x, from.y).lineTo(want.to.x, want.to.y).build();
      out.push({ kind: 'path', path, stroke: { paint: { kind: 'solid', color: style.conflictStroke }, width: 1.5, dash: DASH } });
    }
    return out;
  });
}

const toScreenIn = (view: View) => (p: Pt): Pt => ({ x: (p.x - view.x) * view.scale.x, y: (p.y - view.y) * view.scale.y });

/**
 * The layer that draws every broken link of the canvas's scene, as one
 * entry: install it with `<SceneCanvas ambient>` or a preset's
 * `contributions`. `constraintsPreset` carries it.
 */
export function createConstraintLinkMarks(style: ConstraintGlyphStyle): SurfaceContribution {
  let scene: Scene<unknown, string, unknown> | undefined;
  let cache: { version: number; links: BrokenConstraintLink[] } | null = null;
  const broken = (sc: Scene<unknown, string, unknown>) => {
    const version = sc.getVersion();
    if (cache?.version !== version) cache = { version, links: brokenConstraintLinks(sc) };
    return cache.links;
  };
  const layer: RenderLayer<unknown> = {
    id: CONSTRAINT_LINK_MARKS_ID,
    label: 'Broken constraint links',
    space: 'screen',
    draw: (data, view) => {
      // The root pass covers the whole canvas; a view pass drawing it too would double it.
      if (!scene || (data as { viewId?: string | null } | null)?.viewId) return [];
      return constraintLinkMarks(broken(scene), toScreenIn(view), style);
    },
  };
  return {
    id: CONSTRAINT_LINK_MARKS_ID,
    eligibility: { always: true },
    overlay: layer,
    attach: (_api: CanvasExtensionApi, deps: ContributionDepReader) => {
      scene = deps.get('scene') as Scene<unknown, string, unknown> | undefined;
      return () => { scene = undefined; cache = null; };
    },
  };
}
