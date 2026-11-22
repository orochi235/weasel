/** Canvas size in CSS pixels. */
export interface Dims {
  width: number;
  height: number;
}

/** What a layer draws into: its size, and the device pixels to the CSS pixel
 *  the frame is painted at, which is what an effect's reach is measured in. */
export interface LayerDims extends Dims {
  dpr: number;
  /** Drawn for a tile of a tiled layer, not for a view: nothing that belongs to a view (its level of
   *  detail record, its hover) should be read or written. */
  bake?: true;
}
