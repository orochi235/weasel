import { DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, type Paint } from '@weasel-js/core';

/** The paint a new shape takes, as a node holds one: `null` is none. */
export type ActivePaint = Paint | null;

/** What the swatches reset to (`D`): a white fill and a black stroke. */
export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: DEFAULT_FILL_COLOR };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

/** What a new shape is painted with before anyone picks a paint: a blue fill rather than the white
 *  `DEFAULT_FILL`, so it lands visible against the white page, and a black stroke. */
export const INITIAL_FILL: ActivePaint = { kind: 'solid', color: '#7ab8d4ff' };
export const INITIAL_STROKE: ActivePaint = DEFAULT_STROKE;
