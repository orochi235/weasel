/** A square on the 20x20 frame that a second glyph is drawn into. */
export interface IconBox {
  x: number;
  y: number;
  size: number;
}

/** Where each named slot of `<Icon>` sits. The center lands on a pixel center at 20px, and within a tenth of one at 16px. */
export const ICON_SLOTS = {
  mark: { x: 10.5, y: 10.5, size: 10 },
} as const satisfies Record<string, IconBox>;

const FRAME = 20;
const STROKE = 1.5;
/** The cleared circle's radius, as a share of the box: the scaled glyph's reach plus a unit of air at the mark slot's size. */
const CLEARING = 0.55;

/**
 * The body of a glyph with a second one drawn into `box`: `over` scaled to fit and stroked at the frame's own
 * weight, and `base` cut away in a circle around it. `maskId` must be unique in the document.
 */
export function inset(base: string, over: string, box: IconBox, maskId: string): string {
  const k = box.size / FRAME;
  const cx = box.x + box.size / 2;
  const cy = box.y + box.size / 2;
  // Sized in user space: a mask sized by its target's bounding box erases a glyph that is one straight line.
  // The fill opacities are restated because the root carries the shade's.
  return (
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${FRAME}" height="${FRAME}" stroke="none" fill-opacity="1">` +
    `<rect width="${FRAME}" height="${FRAME}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${box.size * CLEARING}" fill="#000"/></mask>` +
    `<g mask="url(#${maskId})">${base}</g>` +
    `<g transform="translate(${box.x} ${box.y}) scale(${k})" stroke-width="${STROKE / k}" fill-opacity="1">${over}</g>`
  );
}
