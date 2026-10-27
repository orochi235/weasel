/**
 * The kit's `text/plain` content handler: a pasted or dropped string becomes
 * a text node. Registered by default with the other kit handlers.
 *
 * Strings that arrive beside a file are passed over: there they describe the
 * file (its name, a URL to it), as when a browser drags an image or the OS
 * copies a file, and the file is what was meant.
 *
 * The node's box is the string's own laid-out size at the default text style,
 * so it holds the text exactly and wraps nowhere the string does not break.
 * Placement is the image handler's: on the point, or centered in the viewport.
 *
 * Priority -110, below every kit handler, so SVG markup and a copied node
 * payload arriving as plain text go to the handlers that read them.
 */
import { measureTextBounds } from '@weasel-js/text';
import type { IngestItem } from '@weasel-js/routing';
import type { ContentHandlerEntry, IngestCtx } from './contentHandlers';
import { arrivalBounds } from './placement';

/** Options for {@link createTextHandler}. */
export interface TextHandlerOptions {
  /** Size of a string's layout box in world units. Default
   *  `measureTextBounds`, which reads the registered font. */
  measure?: (text: string) => { width: number; height: number };
}

/** Build the plain-text content handler; {@link kitTextHandler} is the one
 *  with the default measurer. */
export function createTextHandler(opts: TextHandlerOptions = {}): ContentHandlerEntry {
  const measure = opts.measure ?? ((text: string) => measureTextBounds(text));
  return {
    id: 'kit:text',
    match: (item: IngestItem) => item.kind === 'string' && item.mime === 'text/plain',
    types: ['text/plain'],
    priority: -110,
    handle(items, ctx: IngestCtx) {
      if ((ctx.items ?? items).some((it) => it.kind === 'file')) return;
      let index = 0;
      for (const item of items) {
        if (item.kind !== 'string') continue;
        const text = item.text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
        if (text.trim() === '') continue;
        ctx.insert.commit(arrivalBounds(ctx, measure(text), index), { kind: 'text', text });
        index++;
      }
    },
  };
}

/** Turns pasted or dropped plain text into a text node sized to the string. Every mounted
 *  canvas registers it, so a canvas with the `ingest` feature takes text. */
export const kitTextHandler: ContentHandlerEntry = createTextHandler();
