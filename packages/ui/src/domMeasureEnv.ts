import type { Ref } from 'react';
import type { MeasureEnv } from '@weasel-js/headless';

let context: CanvasRenderingContext2D | null = null;

/**
 * A DOM {@link MeasureEnv}: tokens as `element` computes them, so a theme or a per-instance override in scope there
 * is read, and text measured by the browser's own fonts on a canvas. Measure from any element inside the themed
 * root, mounted or not yet laid out.
 */
export function domMeasureEnv(element: Element): MeasureEnv {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  return {
    token(name) {
      const v = style.getPropertyValue(name).trim();
      return v === '' ? undefined : v;
    },
    text(text, font) {
      context ??= element.ownerDocument.createElement('canvas').getContext('2d');
      if (!context) return { width: 0, ascent: font.size * 0.8, descent: font.size * 0.2 };
      context.font = `${font.weight ?? 400} ${font.size}px ${font.family ?? 'sans-serif'}`;
      const m = context.measureText(text);
      return { width: m.width, ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent };
    },
  };
}

/** Where a DOM component on the measure/draw contract mounts: the target its `draw` takes. */
export interface DomTarget<E extends Element> {
  readonly ref?: Ref<E>;
}
