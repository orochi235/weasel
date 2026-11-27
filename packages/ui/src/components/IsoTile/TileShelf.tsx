import type { ReactElement } from 'react';
import { IsoTile } from './IsoTile';
import { outlineOf } from './isoGeometry';
import { shelfLayoutFor, type TileShelfGroup } from './tileShelfLayout';
import { useTrace } from './useTrace';
import s from './TileShelf.module.css';

const LABEL = 13;
/** Room above the tiles for a marked tile's dot. */
const DOT = 6;

/** Props for `<TileShelf>`. */
export interface TileShelfProps {
  /** Laid left to right, each group's items in order, its label centered under them. */
  groups: readonly TileShelfGroup[];
  /** The key traced, when the caller holds it (to share one trace across charts). Not given, the shelf keeps its own. */
  traced?: string | null;
  /** Hears a hover start (the tile's key) or end (`null`). */
  onTrace?: (key: string | null) => void;
  /** Given, tiles show a pointer cursor, a click passes the tile's key, and each tile is a button named by its
   *  `title` that takes focus (tracing its key) and answers Enter and Space. The chart is then a group, not an image. */
  onPick?: (key: string) => void;
  'aria-label': string;
  className?: string;
  /** Default 7. */
  tileWidth?: number;
  /** Default 26. */
  tileHeight?: number;
  /** Between tiles in a group. Default 2. */
  gap?: number;
  /** Between groups. Default 14. */
  groupGap?: number;
  /** How far a tile's top and side recede. Default 6. */
  depth?: number;
}

/**
 * Isometric tiles standing on end along a shelf in labeled groups, each tile one item colored by its tone, with an
 * optional dot above it. While a key on the shelf is traced, its whole group keeps its colors, the other groups fade
 * to `--tile-faded`, and the traced tile is outlined above its neighbors.
 */
export function TileShelf({
  groups, traced: tracedGiven, onTrace, onPick, 'aria-label': label, className,
  tileWidth = 7, tileHeight = 26, gap = 2, groupGap = 14, depth = 6,
}: TileShelfProps): ReactElement {
  const [traced, setTraced] = useTrace(tracedGiven, onTrace);
  const layout = shelfLayoutFor(groups, { tileWidth, gap, groupGap, depth });
  const base = DOT + depth + tileHeight;
  const top = base - tileHeight;
  const tracedTile = traced === null ? undefined : layout.groups.flatMap((g) => g.tiles).find((t) => t.item.key === traced);
  const classes = [s.shelf, tracedTile ? s.tracing : '', className].filter(Boolean).join(' ');
  return (
    <svg className={classes} viewBox={`0 0 ${layout.width} ${base + LABEL}`} width={layout.width} role={onPick ? 'group' : 'img'} aria-label={label}>
      <line className={s.board} x1={0} x2={layout.width} y1={base} y2={base} />
      {layout.groups.map(({ group, tiles, labelX }) => (
        <g key={group.key} className={s.group} data-traced={tiles.some((t) => t.item.key === traced) ? '' : undefined}>
          {tiles.map(({ item, x }) => (
            <IsoTile key={item.key} x={x} y={top} width={tileWidth} height={tileHeight} depth={depth}
              tone={item.tone} title={item.title} traced={item.key === traced}
              onPointerEnter={() => setTraced(item.key)} onPointerLeave={() => setTraced(null)}
              onFocus={() => setTraced(item.key)} onBlur={() => setTraced(null)}
              onClick={onPick ? () => onPick(item.key) : undefined}>
              {item.marked && <circle className={s.dot} cx={x + depth + tileWidth / 2} cy={top - depth - 3.5} r={1.8} />}
            </IsoTile>
          ))}
          <text className={s.label} x={labelX} y={base + LABEL - 2}>{group.label}</text>
        </g>
      ))}
      {/* Drawn after every tile, so no neighbor's faces cover an edge of it. */}
      {tracedTile && <polygon className={s.outline} points={outlineOf({ x: tracedTile.x, y: top, width: tileWidth, height: tileHeight, depth })} />}
    </svg>
  );
}
