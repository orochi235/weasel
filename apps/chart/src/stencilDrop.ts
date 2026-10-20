import type { ContentHandlerEntry, IngestCtx, InsertExtras } from '@weasel-js/core';
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
type Bounds = Point & { width: number; height: number };

const PROBE = Symbol('stencil drop probe');

/** How far a move pressed at `press` snaps a body inserted at `bounds` before it has moved.
 *  The body is inserted in a batch that is thrown away, so the probe never reaches history. */
function landingDelta(ctx: IngestCtx, bounds: Bounds, extras: InsertExtras, press: Point): Point {
  const snap = ctx.snap;
  if (!snap) return { x: 0, y: 0 };
  let delta = { x: 0, y: 0 };
  try {
    ctx.scene.batch('Drop', () => {
      const id = ctx.insert.commit(bounds, extras);
      if (id !== null) {
        const session = snap.begin({ gesture: 'move', press, ids: [id] });
        const landed = session.at(press, { suspend: false, constrain: false }).point;
        session.end();
        delta = { x: landed.x - press.x, y: landed.y - press.y };
      }
      throw PROBE;
    });
  } catch (err) {
    if (err !== PROBE) throw err;
  }
  return delta;
}

/** The content handler that inserts a dropped stencil centered on the drop point, through the
 *  `insert` dep, shifted as far as a move of it from there would snap it. */
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
      const bounds = { x: at.x - stencil.size.width / 2, y: at.y - stencil.size.height / 2, ...stencil.size };
      const extras: InsertExtras = { kind: stencilKind(stencil.id) };
      const d = landingDelta(ctx, bounds, extras, at);
      ctx.insert.commit({ ...bounds, x: bounds.x + d.x, y: bounds.y + d.y }, extras);
    }
  },
};
