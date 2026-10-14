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
/** The width of the band cleared around the second glyph, on the frame. */
const GAP = 1.5;

/**
 * The body of a glyph with a second one drawn into `box`: `over` scaled to fit and stroked at the frame's own
 * weight, and `base` cut away from `over`'s silhouette and a band of `GAP` around it. `maskId` must be unique in
 * the document.
 */
export function inset(base: string, over: string, box: IconBox, maskId: string): string {
  const k = box.size / FRAME;
  const place = `transform="translate(${box.x} ${box.y}) scale(${k})"`;
  // The silhouette is `over` again, every part filled and stroked wider by the band. A part drawn without a
  // stroke gets one as wide as the band alone, and a hole drawn by fill rule closes up.
  const silhouette = over
    .replaceAll('stroke="none"', `stroke-width="${(2 * GAP) / k}"`)
    .replaceAll(' fill-rule="evenodd"', '');
  // Sized in user space: a mask sized by its target's bounding box erases a glyph that is one straight line.
  // The fill opacities are restated because the root carries the shade's.
  return (
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${FRAME}" height="${FRAME}" stroke="none" fill-opacity="1">` +
    `<rect width="${FRAME}" height="${FRAME}" fill="#fff"/>` +
    `<g ${place} color="#000" fill="#000" stroke="#000" stroke-width="${(STROKE + 2 * GAP) / k}">${silhouette}</g></mask>` +
    `<g mask="url(#${maskId})">${base}</g>` +
    `<g ${place} stroke-width="${STROKE / k}" fill-opacity="1">${over}</g>`
  );
}
