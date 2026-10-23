import type { Point } from '@weasel-js/geom';

/**
 * A client point in the px of the box `frame` fills, an SVG drawn across it: inverted through its screen matrix, so a
 * scaled or rotated ancestor maps it back. Without one (an HTML frame, or jsdom) it is offset from the client rect.
 */
export function boxPoint(frame: Element, clientX: number, clientY: number): Point {
  const m = frame instanceof SVGGraphicsElement ? frame.getScreenCTM?.() : null;
  if (m) {
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  const { left, top } = frame.getBoundingClientRect();
  return { x: clientX - left, y: clientY - top };
}
