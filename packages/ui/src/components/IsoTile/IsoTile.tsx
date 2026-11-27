import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { sideFaceOf, topFaceOf } from './isoGeometry';
import s from './IsoTile.module.css';

/** One tile in a tile chart: plain data a consumer maps its own states onto. */
export interface TileItem {
  /** Identifies the item across charts: tracing one key lights every tile carrying it. */
  key: string;
  /** Class names giving the tile its color by setting `--tile`. Default: a neutral gray. */
  tone?: string;
  /** The tile's hover text. */
  title?: string;
}

/** Props for `<IsoTile>`. */
export interface IsoTileProps {
  /** The front face's left edge, in the SVG's units. */
  x: number;
  /** The front face's top edge. */
  y: number;
  width: number;
  height: number;
  /** How far the top and side faces recede, up and to the right. */
  depth: number;
  /** Class names giving the tile its color by setting `--tile`. */
  tone?: string;
  title?: string;
  /** Marks the tile `data-traced`, so a tone can restyle the traced tile (`.mine[data-traced]`). */
  traced?: boolean;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  /** Keyboard focus arriving, on a tile that has `onClick`. */
  onFocus?: () => void;
  /** Keyboard focus leaving, on a tile that has `onClick`. */
  onBlur?: () => void;
  /** Given, the tile shows a pointer cursor, hears clicks, and is a button named by its `title`: it takes focus and
   *  answers Enter and Space. */
  onClick?: () => void;
  /** Drawn after the faces, in the same coordinates: a marker on the tile. */
  children?: ReactNode;
}

/**
 * A tile drawn in SVG as a front face with a lit top and a shaded side receding up and to the right, every face in
 * the color its `tone` gives `--tile`. Goes inside an `<svg>`.
 *
 * Inside a tile chart, a faded tile shows `--tile-shown` in place of `--tile`; `--tile-lit` (default 1.3) and
 * `--tile-edge` (default 0.5) set the top face's brightness and the faces' edge width.
 */
export function IsoTile({
  x, y, width, height, depth, tone, title, traced = false, onPointerEnter, onPointerLeave, onFocus, onBlur, onClick, children,
}: IsoTileProps): ReactElement {
  const box = { x, y, width, height, depth };
  const className = [s.tile, tone, onClick ? s.pickable : ''].filter(Boolean).join(' ');
  const press = onClick && ((e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onClick();
  });
  const button = onClick ? { role: 'button', tabIndex: 0, 'aria-label': title, onKeyDown: press, onFocus, onBlur } : {};
  return (
    <g className={className} data-traced={traced ? '' : undefined} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}
      onClick={onClick} {...button}>
      {title !== undefined && <title>{title}</title>}
      <rect className={s.face} x={x} y={y} width={width} height={height} />
      <polygon className={`${s.face} ${s.top}`} points={topFaceOf(box)} />
      <polygon className={`${s.face} ${s.side}`} points={sideFaceOf(box)} />
      {children}
    </g>
  );
}
