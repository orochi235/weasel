/** A category axis: one band per label, in order. */
export interface XyBandAxis {
  kind: 'band';
  title?: string;
  categories: readonly string[];
}

/** A numeric axis from `min` to `max`, the series' values spread evenly across it. */
export interface XyRangeAxis {
  kind: 'range';
  title?: string;
  min: number;
  max: number;
}

/** The value axis. A missing end fits the series' values, zero included. */
export interface XyValueAxis {
  title?: string;
  min?: number;
  max?: number;
}

/** One series: a value per category, drawn as bars or as a line. */
export interface XySeries {
  kind: 'bar' | 'line';
  name?: string;
  values: readonly number[];
}

/** A bar and line chart over categories or a numeric range. */
export interface XyChartData {
  kind: 'xychart';
  title?: string;
  /** Default `'vertical'`: categories along x, values up y. */
  orientation?: 'vertical' | 'horizontal';
  /** Absent, bands numbered from 1, one per value of the longest series. */
  x?: XyBandAxis | XyRangeAxis;
  y?: XyValueAxis;
  series: readonly XySeries[];
}
