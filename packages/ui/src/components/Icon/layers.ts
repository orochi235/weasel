import { ICON_FRAME, markLayers } from '@weasel-js/icons';

/**
 * The body of a glyph with a mark set in its corner, the glyph cut away under the mark and a band around it
 * by an SVG mask. `maskId` must be unique in the document.
 */
export function inset(base: string, markBody: string, maskId: string): string {
  const { box, mark, cut } = markLayers(markBody);
  const place = `transform="translate(${box.x} ${box.y}) scale(${box.size / ICON_FRAME})"`;
  // Sized in user space: a mask sized by its target's bounding box erases a glyph that is one straight line.
  // The fill opacities are restated because the root carries the shade's.
  return (
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${ICON_FRAME}" height="${ICON_FRAME}" stroke="none" fill-opacity="1">` +
    `<rect width="${ICON_FRAME}" height="${ICON_FRAME}" fill="#fff"/>` +
    `<g ${place} color="#000" ${cut.attrs}>${cut.body}</g></mask>` +
    `<g mask="url(#${maskId})">${base}</g>` +
    `<g ${place} ${mark.attrs}>${mark.body}</g>`
  );
}
