import type { ContentHandlerEntry } from '@weasel-js/core';
import { stencilKind } from '@weasel-js/diagram';

/** The drag type a Shapes panel row carries its stencil id under. */
export const STENCIL_MIME = 'application/x-weaselchart-stencil';

/** The content handler that inserts a dropped stencil centered on the drop point, through the `insert` dep. */
export const stencilDropHandler: ContentHandlerEntry = {
  id: 'weaselchart:stencil',
  match: STENCIL_MIME,
  handle(items, ctx) {
    const view = ctx.viewportWorldRect();
    const at = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    for (const item of items) {
      if (item.kind === 'string' && item.text) {
        ctx.insert.commit({ x: at.x, y: at.y, width: 0, height: 0 }, { kind: stencilKind(item.text) });
      }
    }
  },
};
