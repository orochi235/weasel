/** The side of the square every glyph is drawn on. */
export const ICON_FRAME = 20;
/** The stroke width a glyph is drawn at on its frame. */
export const ICON_STROKE = 1.5;

/** A square on the frame that a second glyph is drawn into. */
export interface IconBox {
  x: number;
  y: number;
  size: number;
}

/** Where each slot a second glyph can take sits. The center lands on a pixel center at 20px, and within a tenth of one at 16px. */
export const ICON_SLOTS = {
  mark: { x: 10.5, y: 10.5, size: 10 },
} as const satisfies Record<string, IconBox>;

/** The width of the band cleared around a mark, on the frame. */
const GAP = 1.5;

/** Markup for a group: the attributes its `<g>` carries, and what it holds. */
export interface GlyphLayer {
  attrs: string;
  body: string;
}

/** What a renderer draws to set a mark on a subject, each layer on the mark's own 20×20 frame. */
export interface MarkLayers {
  /** Where the mark's frame sits on the subject's. */
  box: IconBox;
  /** The mark stroked at the subject's weight once scaled into `box`. */
  mark: GlyphLayer;
  /** Everything the subject is cut away under: the mark's silhouette, filled, grown by the band. */
  cut: GlyphLayer;
}

/** A layer as one `<g>`. */
export const layerMarkup = ({ attrs, body }: GlyphLayer): string => `<g ${attrs}>${body}</g>`;

/**
 * The layers that set `markBody` on another glyph: draw the subject, erase `cut` from it, then draw `mark`,
 * the two placed in `box`. `<Icon mark>` does it with an SVG mask and hud with a `destination-out` group.
 */
export function markLayers(markBody: string, box: IconBox = ICON_SLOTS.mark): MarkLayers {
  const k = box.size / ICON_FRAME;
  // A part drawn without a stroke gets one as wide as the band alone, and a hole drawn by fill rule closes up.
  const silhouette = markBody
    .replaceAll('stroke="none"', `stroke-width="${(2 * GAP) / k}"`)
    .replaceAll(' fill-rule="evenodd"', '');
  return {
    box,
    mark: { attrs: `stroke-width="${ICON_STROKE / k}" fill-opacity="1"`, body: markBody },
    cut: {
      attrs: `fill="currentColor" stroke="currentColor" fill-opacity="1" stroke-width="${(ICON_STROKE + 2 * GAP) / k}"`,
      body: silhouette,
    },
  };
}
