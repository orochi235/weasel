/** One spoke of a radar chart. */
export interface RadarAxis {
  id: string;
  /** Default its id. */
  label?: string;
}

/** One curve: a value on each axis, in axis order. */
export interface RadarCurve {
  id: string;
  /** Default its id. */
  label?: string;
  values: readonly number[];
}

/** A radar chart: curves drawn as areas over spokes from a center. */
export interface RadarData {
  kind: 'radar';
  title?: string;
  axes: readonly RadarAxis[];
  curves: readonly RadarCurve[];
  /** The value at the center. Default 0. */
  min?: number;
  /** The value at the rim. Default the largest value. */
  max?: number;
  /** Default `'circle'`. */
  graticule?: 'circle' | 'polygon';
  /** How many rings the graticule has. Default 5. */
  ticks?: number;
  /** Default true. */
  showLegend?: boolean;
}
