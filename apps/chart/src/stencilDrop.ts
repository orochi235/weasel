import type { ContentHandlerEntry, IngestCtx } from '@weasel-js/core';
import { FLOWCHART_STENCILS, stencilKind } from '@weasel-js/diagram';

// The kit's drop path keeps only text/plain, text/html and text/uri-list string flavors, so a
// stencil row carries its id as tagged plain text rather than under a type of its own.
const PREFIX = 'weaselchart-stencil:';

/** What a dragged stencil row carries as `text/plain`. */
export const stencilDragText = (stencilId: string): string => `${PREFIX}${stencilId}`;

/** The stencil id dragged text names, or `null` for text that names none. */
export const stencilIdOfDragText = (text: string): string | null =>
  text.startsWith(PREFIX) ? text.slice(PREFIX.length) : null;

type Point = { x: number; y: number };

/** Where a stencil centered on `at` puts its origin, snapped as a moved body's origin would be. */
function snappedOrigin(ctx: IngestCtx, at: Point, size: { width: number; height: number }): Point {
  const origin = { x: at.x - size.width / 2, y: at.y - size.height / 2 };
  // A move offers no other node's anchors, so neither does a drop.
  const session = ctx.snap?.begin({ gesture: 'point', press: origin, omit: ['path-snap'] });
  if (!session) return origin;
  const landed = session.at(origin, { suspend: false, constrain: false }).point;
  session.end();
  return landed;
}

/** The content handler that inserts a dropped stencil centered on the drop point, through the
 *  `insert` dep, its origin snapped through the `snap` dep. */
export const stencilDropHandler: ContentHandlerEntry = {
  id: 'weaselchart:stencil',
  match: (item) => item.kind === 'string' && item.mime === 'text/plain' && stencilIdOfDragText(item.text) !== null,
  types: ['text/plain'],
  handle(items, ctx) {
    const view = ctx.viewportWorldRect();
    const at = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    for (const item of items) {
      const id = item.kind === 'string' ? stencilIdOfDragText(item.text) : null;
      const stencil = FLOWCHART_STENCILS.find((s) => s.id === id);
      if (stencil === undefined) continue;
      const origin = snappedOrigin(ctx, at, stencil.size);
      ctx.insert.commit({ ...origin, ...stencil.size }, { kind: stencilKind(stencil.id) });
    }
  },
};
