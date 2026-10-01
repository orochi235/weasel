import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import {
  createLoupeModel,
  loupeInnerView,
  type LoupePoint,
  type LoupeRect,
  type LoupeSurface,
} from '@weasel-js/loupe';
import s from './LoupeModelDemo.module.css';
import { decimal, qty } from '@weasel-js/quantity';

const CELL = 8, COLS = 48, ROWS = 32;
const GRID_W = CELL * COLS, GRID_H = CELL * ROWS;
const LENS: LoupeRect = { x: GRID_W + 24, y: 0, w: 192, h: 192 };
const PALETTE = ['#1f2430', '#e5484d', '#f5a524', '#46a758', '#0091ff', '#8e4ec6', '#f4f4f5', '#c9ccd4'];

const colorAt = (col: number, row: number) => PALETTE[((col * 7) ^ (row * 13) ^ (col * row)) & 7]!;

const CELLS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  return { x: col * CELL, y: row * CELL, color: colorAt(col, row) };
});

const within = (p: LoupePoint, r: LoupeRect) =>
  p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** The whole painter contract, answered from plain data: the colors are known,
 *  so nothing is read back from pixels. */
function gridSurface(changed: () => void): LoupeSurface {
  return {
    lens: () => LENS,
    covers: (p) => within(p, LENS),
    sample: (p) =>
      p.x >= 0 && p.x < GRID_W && p.y >= 0 && p.y < GRID_H
        ? colorAt(Math.floor(p.x / CELL), Math.floor(p.y / CELL))
        : null,
    hidden: () => false,
    gone: () => false,
    changed,
  };
}

const fmt = (n: number) => qty(n, decimal({ places: 2, grouping: false })).text.padStart(7, '\u2007');

function Swatch({ color }: { color: string | null }) {
  if (!color) return <>—</>;
  return (
    <>
      <svg className={s.swatch} viewBox="0 0 1 1" aria-hidden="true"><rect width="1" height="1" fill={color} /></svg>
      {color}
    </>
  );
}

export function LoupeModelDemo() {
  const gridId = useId();
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [pointer, setPointer] = useState<LoupePoint | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const loupe = useMemo(
    () => createLoupeModel({
      surface: gridSurface(redraw),
      factor: 8,
      minFactor: 2,
      maxFactor: 32,
      onPick: setPicked,
    }),
    [],
  );
  useEffect(() => () => loupe.dispose(), [loupe]);

  const stage = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // React's own onWheel is passive and cannot stop the page scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      loupe.setFactor(loupe.factor * (e.deltaY < 0 ? 1.25 : 0.8));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loupe]);

  const toSurface = (e: React.PointerEvent | React.MouseEvent): LoupePoint => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // The stage is drawn 1:1, so the outer view is the identity.
  const inner = loupeInnerView(loupe.aim, { x: 0, y: 0, scale: { x: 1, y: 1 } }, LENS, loupe.factor);
  const frozen = pointer !== null && within(pointer, LENS);

  return (
    <div className={s.demo}>
      <svg
        ref={stage}
        className={s.stage}
        width={LENS.x + LENS.w}
        height={GRID_H}
        shapeRendering="crispEdges"
        onPointerMove={(e) => {
          const p = toSurface(e);
          setPointer(p);
          loupe.aimAt(p);
        }}
        onPointerLeave={() => setPointer(null)}
        onClick={(e) => {
          const p = toSurface(e);
          if (within(p, LENS)) loupe.pick(p);
        }}
      >
        <defs>
          <g id={gridId}>
            {CELLS.map((c) => <rect key={`${c.x},${c.y}`} x={c.x} y={c.y} width={CELL} height={CELL} fill={c.color} />)}
          </g>
        </defs>
        <use href={`#${gridId}`} />
        <path className={s.crosshair} d={`M${loupe.aim.x - 6} ${loupe.aim.y}h12M${loupe.aim.x} ${loupe.aim.y - 6}v12`} />
        {/* The painter's whole job: show the grid through the inner view. */}
        <svg
          x={LENS.x}
          y={LENS.y}
          width={LENS.w}
          height={LENS.h}
          viewBox={`${inner.x} ${inner.y} ${LENS.w / inner.scale.x} ${LENS.h / inner.scale.y}`}
        >
          <rect className={s.lensGround} x={inner.x} y={inner.y} width={LENS.w / inner.scale.x} height={LENS.h / inner.scale.y} />
          <use href={`#${gridId}`} />
        </svg>
        <rect className={s.lensFrame} x={LENS.x + 0.5} y={LENS.y + 0.5} width={LENS.w - 1} height={LENS.h - 1} />
      </svg>

      <table className={s.readout}>
        <tbody>
          <tr><th>pointer</th><td>{pointer ? `${fmt(pointer.x)} ${fmt(pointer.y)}` : '—'}</td></tr>
          <tr>
            <th>aim</th>
            <td>
              {fmt(loupe.aim.x)} {fmt(loupe.aim.y)}
              {frozen && <span className={s.note}>held: the lens covers the pointer</span>}
            </td>
          </tr>
          <tr><th>factor</th><td>{fmt(loupe.factor)}×</td></tr>
          <tr><th>inner view</th><td>{fmt(inner.x)} {fmt(inner.y)} at {fmt(inner.scale.x)}×</td></tr>
          <tr><th>color</th><td><Swatch color={loupe.color} /></td></tr>
          <tr><th>picked</th><td><Swatch color={picked} /></td></tr>
        </tbody>
      </table>
    </div>
  );
}
