import type { Path } from '@weasel-js/geom';

/** The kinds of mark a chart is drawn with. */
export type MarkKind = 'bar' | 'span' | 'line' | 'area' | 'point' | 'arc' | 'ribbon' | 'rule' | 'text';

/** The value a mark stands for, as plain fields: a series and index, a category, a value. */
export type PlotDatum = Readonly<Record<string, string | number | boolean>>;

/** What a mark's scene data says about it: its kind, and the datum it draws. */
export interface PlotMarkTrait {
  kind: MarkKind;
  datum?: PlotDatum;
}

/** A solid paint, as the kit's painters read one. */
export interface SolidFill {
  paint: { color: string; opacity?: number };
}

/** A solid stroke, as the kit's painters read one. */
export interface SolidStroke {
  paint: { color: string };
  width: number;
  dash?: number[];
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
}

/**
 * A mark's scene data: the trait under `plotMark`, and the fields the kit's
 * painters draw it from — `shape` for a box, `path` for a line or a region,
 * `text` for a label.
 */
export interface PlotMarkData {
  plotMark: PlotMarkTrait;
  shape?: 'rect' | 'ellipse';
  path?: Path;
  fill?: SolidFill;
  stroke?: SolidStroke;
  text?: string;
  style?: { fontFamily: string; fontSize: number; align?: 'left' | 'center' | 'right'; fontWeight?: number };
  verticalAlign?: 'top' | 'center' | 'bottom';
}

/** A box, in the plot's own coordinates: from its root's corner. */
export interface PlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radians about the box's center. */
  rotation?: number;
}

/** One mark, ready to be a scene node: a key unique within its plot, where it is drawn, and its data. */
export interface PlotMark {
  key: string;
  pose: PlotBox;
  data: PlotMarkData;
}

/** A point in the plot's coordinates. */
export interface PlotPoint {
  x: number;
  y: number;
}
