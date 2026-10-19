import type { ContentHandlerEntry } from '@weasel-js/core';
import { stencilKind } from '@weasel-js/diagram';

// The kit's drop path keeps only text/plain, text/html and text/uri-list string flavors, so a
// stencil row carries its id as tagged plain text rather than under a type of its own.
const PREFIX = 'weaselchart-stencil:';

/** What a dragged stencil row carries as `text/plain`. */
export const stencilDragText = (stencilId: string): string => `${PREFIX}${stencilId}`;

/** The stencil id dragged text names, or `null` for text that names none. */
export const stencilIdOfDragText = (text: string): string | null =>
  text.startsWith(PREFIX) ? text.slice(PREFIX.length) : null;

/** The content handler that inserts a dropped stencil centered on the drop point, through the `insert` dep. */
export const stencilDropHandler: ContentHandlerEntry = {
  id: 'weaselchart:stencil',
  match: (item) => item.kind === 'string' && item.mime === 'text/plain' && stencilIdOfDragText(item.text) !== null,
  types: ['text/plain'],
  handle(items, ctx) {
    const view = ctx.viewportWorldRect();
    const at = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    for (const item of items) {
      const id = item.kind === 'string' ? stencilIdOfDragText(item.text) : null;
      if (id !== null) ctx.insert.commit({ x: at.x, y: at.y, width: 0, height: 0 }, { kind: stencilKind(id) });
    }
  },
};
