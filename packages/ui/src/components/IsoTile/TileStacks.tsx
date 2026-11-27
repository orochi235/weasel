import type { ReactElement } from 'react';
import { IsoTile, type TileItem } from './IsoTile';
import { topFaceOf } from './isoGeometry';
import { defaultTicksFor, stacksLayoutFor } from './tileStacksLayout';
import { useTrace } from './useTrace';
import s from './TileStacks.module.css';

/** Props for `<TileStacks>`. */
export interface TileStacksProps {
  /** One stack per column along the axis, each listed bottom to top. A key may stand in several columns. */
  columns: readonly (readonly TileItem[])[];
  /** How many columns the axis runs to, leaving room for more. Default, and never less than, `columns.length`. */
  span?: number;
  /** The column numbers (from 1) labeled under the axis. Default: 1 and every fifth. */
  ticks?: readonly number[];
  /** Whether a column with no tiles shows a patch on the ground where its stack would stand. Default `true`. */
  showEmpty?: boolean;
  /** An empty column's hover text, given its number. */
  emptyTitle?: (column: number) => string;
  /** A label after the last column: what is still to come, say. */
  trailing?: string;
  /** The room the trailing label takes. Default 120. */
  trailingWidth?: number;
  /** The key traced, when the caller holds it (to share one trace across charts). Not given, the chart keeps its own. */
  traced?: string | null;
  /** Hears a hover start (the tile's key) or end (`null`). */
  onTrace?: (key: string | null) => void;
  /** Given, tiles show a pointer cursor and a click passes the tile's key. */
  onPick?: (key: string) => void;
  'aria-label': string;
  className?: string;
  /** The distance between columns. Default 38. */
  pitch?: number;
  /** Default 28. */
  tileWidth?: number;
  /** Default 7. */
  tileHeight?: number;
  /** How far a tile's top and side recede. Default 8. */
  depth?: number;
}

/**
 * Columns of isometric tiles stacked along an axis, with column numbers under it: a count per column where every unit
 * is an item that can be hovered, traced across charts, and picked. While a key is traced, every tile carrying it
 * keeps its color and the rest fade to `--tile-faded`.
 */
export function TileStacks({
  columns, span: spanGiven, ticks, showEmpty = true, emptyTitle, trailing, trailingWidth = 120, traced: tracedGiven, onTrace, onPick,
  'aria-label': label, className, pitch = 38, tileWidth = 28, tileHeight = 7, depth = 8,
}: TileStacksProps): ReactElement {
  const [traced, setTraced] = useTrace(tracedGiven, onTrace);
  const span = Math.max(columns.length, spanGiven ?? 0);
  const layout = stacksLayoutFor(columns, span, { pitch, tileWidth, tileHeight, depth, trailingWidth: trailing ? trailingWidth : 0 });
  const tracing = traced !== null && layout.tiles.some((t) => t.item.key === traced);
  const classes = [s.chart, tracing ? s.tracing : '', className].filter(Boolean).join(' ');
  return (
    <svg className={classes} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} role="img" aria-label={label}>
      <line className={s.base} x1={0} x2={layout.axisEnd} y1={layout.base} y2={layout.base} />
      {(ticks ?? defaultTicksFor(span)).map((t) => <text key={t} className={s.tick} x={layout.tickX(t)} y={layout.height - 1}>{t}</text>)}
      {showEmpty && layout.empties.map(({ column, x }) => (
        <polygon key={`empty-${column}`} className={s.empty} points={topFaceOf({ x, y: layout.base, width: tileWidth, height: 0, depth })}>
          {emptyTitle && <title>{emptyTitle(column)}</title>}
        </polygon>
      ))}
      {layout.tiles.map(({ item, column, x, y }) => (
        <IsoTile key={`${column}-${item.key}`} x={x} y={y} width={tileWidth} height={tileHeight} depth={depth}
          tone={item.tone} title={item.title} traced={item.key === traced}
          onPointerEnter={() => setTraced(item.key)} onPointerLeave={() => setTraced(null)}
          onClick={onPick ? () => onPick(item.key) : undefined} />
      ))}
      {trailing && <text className={s.trailing} x={layout.trailingX} y={layout.base - 2}>{trailing}</text>}
    </svg>
  );
}
