/** A rung's name: `'full'`, `'box'`, `'none'`, or one a painter's `ladder` declares. */
export type RungId = string;

/** One node's own level-of-detail thresholds, saved with it: each names a rung of its painter's
 *  ladder or a built-in, and the device-pixel size it is shown from. */
export type NodeLod = readonly { readonly as: RungId; readonly fromPx: number }[];
