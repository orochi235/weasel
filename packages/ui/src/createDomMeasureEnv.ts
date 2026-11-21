import { cssFamilyName } from '@weasel-js/font';
import type { Ref } from 'react';
import type { MeasureEnv } from '@weasel-js/ui-logic';

/** One measuring canvas per document: a canvas resolves fonts against its own document's font set. */
const contexts = new WeakMap<Document, CanvasRenderingContext2D | null>();

function contextIn(doc: Document): CanvasRenderingContext2D | null {
  if (!contexts.has(doc)) contexts.set(doc, doc.createElement('canvas').getContext('2d'));
  return contexts.get(doc)!;
}

/**
 * A DOM {@link MeasureEnv}: tokens as `element` computes them, so a theme or a per-instance override in scope there
 * is read, and text measured by the browser's own fonts on a canvas. Measure from any element inside the themed
 * root, mounted or not yet laid out.
 */
export function createDomMeasureEnv(element: Element): MeasureEnv {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  return {
    token(name) {
      const v = style.getPropertyValue(name).trim();
      return v === '' ? undefined : v;
    },
    text(text, font) {
      const context = contextIn(element.ownerDocument);
      if (!context) return { width: 0, ascent: font.size * 0.8, descent: font.size * 0.2 };
      context.font = `${font.weight ?? 400} ${font.size}px ${cssFamilyName(font.family ?? 'sans-serif')}`;
      const m = context.measureText(text);
      const extent = { width: m.width, ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent };
      return trimsToCaps(element) ? { ...extent, capHeight: context.measureText('H').actualBoundingBoxAscent } : extent;
    },
  };
}

/** Whether this browser trims a label to its capitals, as theme's `capText` asks; one that cannot sets the whole line. */
function trimsToCaps(element: Element): boolean {
  return element.ownerDocument.defaultView?.CSS?.supports?.('text-box', 'trim-both cap alphabetic') ?? false;
}

/** Where a DOM component on the measure/draw contract mounts: the target its `draw` takes. */
export interface DomTarget<E extends Element> {
  readonly ref?: Ref<E>;
}
