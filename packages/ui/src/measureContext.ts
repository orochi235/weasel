import { createPart } from '@weasel-js/registry';

/** A 2D context for measuring text in `doc`'s fonts, or null where it has no canvas. One per document: a canvas
 *  resolves fonts against its own document's font set. */
export const measureContextIn = createPart(
  (doc: Document): CanvasRenderingContext2D | null => doc.createElement('canvas').getContext('2d'),
);
