import { moveNodes, type ContentHandlerEntry, type IngestCtx } from '@weasel-js/core';
import { stencilKind } from '@weasel-js/diagram';

/** The drag type a Shapes panel row carries its stencil id under. */
export const STENCIL_MIME = 'application/x-weaselchart-stencil';

type Point = { x: number; y: number };

/** How far a move of `id` pressed at `press` snaps it before it has moved. */
function landingDelta(ctx: IngestCtx, id: string, press: Point): { dx: number; dy: number } {
  if (!ctx.snap) return { dx: 0, dy: 0 };
  const session = ctx.snap.begin({ gesture: 'move', press, ids: [id] });
  try {
    const landed = session.at(press, { suspend: false, constrain: false }).point;
    return { dx: landed.x - press.x, dy: landed.y - press.y };
  } finally {
    session.end();
  }
}

/** The content handler that inserts a dropped stencil centered on the drop point, through the
 *  `insert` dep, then moves it as far as a move of it from there would snap it: one undo step. */
export const stencilDropHandler: ContentHandlerEntry = {
  id: 'weaselchart:stencil',
  match: STENCIL_MIME,
  handle(items, ctx) {
    const view = ctx.viewportWorldRect();
    const at = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    for (const item of items) {
      if (item.kind !== 'string' || !item.text) continue;
      const kind = stencilKind(item.text);
      ctx.scene.batch('Drop', () => {
        const id = ctx.insert.commit({ x: at.x, y: at.y, width: 0, height: 0 }, { kind });
        if (id !== null) moveNodes(ctx.deps, [id], landingDelta(ctx, id, at), 'Drop');
      });
    }
  },
};
