/** How a point is drawn. Any field absent takes the class's, then the theme's. */
export interface QuadrantPointStyle {
  radius?: number;
  color?: string;
  strokeColor?: string;
  /** In pixels. */
  strokeWidth?: number;
}

/** One point, at `x` and `y` from 0 to 1. */
export interface QuadrantPoint {
  name: string;
  x: number;
  y: number;
  /** A key into the chart's `classes`. */
  className?: string;
  style?: QuadrantPointStyle;
}

/** An axis's two ends' labels. */
export interface QuadrantAxis {
  low?: string;
  high?: string;
}

/** A quadrant chart: points in the unit square, cut into four labeled quadrants. */
export interface QuadrantData {
  kind: 'quadrant';
  title?: string;
  x?: QuadrantAxis;
  y?: QuadrantAxis;
  /** Quadrant labels, in Mermaid's order: top right, top left, bottom left, bottom right. */
  quadrants?: readonly [string?, string?, string?, string?];
  points: readonly QuadrantPoint[];
  /** Named point styles. */
  classes?: Readonly<Record<string, QuadrantPointStyle>>;
}
