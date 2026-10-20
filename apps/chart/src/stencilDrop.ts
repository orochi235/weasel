import type { ContentHandlerEntry, IngestCtx, InsertExtras } from '@weasel-js/core';
import { stencilKind } from '@weasel-js/diagram';

/** The drag type a Shapes panel row carries its stencil id under. */
export const STENCIL_MIME = 'application/x-weaselchart-stencil';

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
  match: STENCIL_MIME,
  handle(items, ctx) {
    const view = ctx.viewportWorldRect();
    const at = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    for (const item of items) {
      if (item.kind !== 'string' || !item.text) continue;
      const bounds = { x: at.x, y: at.y, width: 0, height: 0 };
      const extras: InsertExtras = { kind: stencilKind(item.text) };
      const d = landingDelta(ctx, bounds, extras, at);
      ctx.insert.commit({ ...bounds, x: bounds.x + d.x, y: bounds.y + d.y }, extras);
    }
  },
};
