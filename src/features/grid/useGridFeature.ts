/**
 * Grid feature in the role-taxonomy shape: `{ api, attrs, layers }`.
 *
 * Pulls together the existing low-level primitives (`useGridCellHover`,
 * `createGridLayer`, `createCellHighlightLayer`) into a single hook a
 * consumer can wire with one call. The low-level primitives stay exported
 * for advanced cases.
 *
 * **Migration test for the feature-roles taxonomy.** See
 * `docs/TODO.md` → "Feature-roles taxonomy" for the design notes.
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { screenToWorld, type ViewTransform } from 'core/viewport/viewTransform';
import { pointToGridCell } from 'interactions/gestures/shared/strategies/grid';
import type { UnitSystem, UnitValue } from 'core/units';
import type { RenderLayer } from 'core/layers/render';
import type { Paint, Stroke } from 'core/paint-types';
import { createGridLayer } from './layer';
import { createCellHighlightLayer } from './cellHighlight';

/** Live state surface other features can consume. */
export interface GridApi {
  /** Current hovered cell, or `null` when the pointer is outside. */
  cell: { col: number; row: number } | null;
  /** Stable getter; reads the live cell without re-render. */
  getCell: () => { col: number; row: number } | null;
}

/** Native DOM attributes/handlers to spread onto the canvas host element. */
export interface GridAttrs {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
}

/** Slot-keyed render-layer contributions. Each entry is
 *  `(current) => RenderLayer<T>`; a "provider" ignores `current` and
 *  returns a fresh layer; a "wrapper" composes. Grid is a pure provider
 *  for both slots — both functions ignore `current`. */
export interface GridLayers {
  grid: <T>(current: RenderLayer<T> | null) => RenderLayer<T>;
  highlight: <T>(current: RenderLayer<T> | null) => RenderLayer<T>;
}

export interface UseGridFeatureOptions {
  /** Cell spacing in world units. Same value flows into all three parts. */
  spacing: UnitValue;
  /** Unit system; required if `spacing` is tagged. */
  unitSystem?: UnitSystem;
  /** Bounds of the area the grid covers, in world units. */
  bounds: () => { x: number; y: number; width: number; height: number };
  /** Read the active view transform (for screen→world projection in attrs). */
  view: () => ViewTransform;
  /** Origin the cell grid is anchored to. Default `(0, 0)`. */
  origin?: { x: number; y: number };
  /** Lines every N cells get the accent style. */
  accentEvery?: number;
  /** Finer subdivisions per cell. */
  subdivisions?: number;
  /** Per-band stroke styles forwarded to `createGridLayer`. */
  style?: { line?: Stroke; accent?: Stroke; sub?: Stroke };
  /** Highlight fill paint forwarded to `createCellHighlightLayer`. */
  highlightFill?: Paint;
  /** Fires when the hovered cell changes. */
  onChange?: (cell: { col: number; row: number } | null) => void;
}

function cellsEqual(
  a: { col: number; row: number } | null,
  b: { col: number; row: number } | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.col === b.col && a.row === b.row;
}

export function useGridFeature(opts: UseGridFeatureOptions): {
  api: GridApi;
  attrs: GridAttrs;
  layers: GridLayers;
} {
  const [cell, setCell] = useState<{ col: number; row: number } | null>(null);
  const cellRef = useRef<{ col: number; row: number } | null>(null);

  // Latest-options ref so the attr callbacks stay stable.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const update = useCallback((next: { col: number; row: number } | null) => {
    if (cellsEqual(cellRef.current, next)) return;
    cellRef.current = next;
    setCell(next);
    optsRef.current.onChange?.(next);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const o = optsRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wx, wy] = screenToWorld(sx, sy, o.view());
    update(pointToGridCell({ x: wx, y: wy }, o.spacing, o.unitSystem, o.origin));
  }, [update]);

  const onPointerLeave = useCallback(() => update(null), [update]);
  const onPointerCancel = useCallback(() => update(null), [update]);

  const getCell = useCallback(() => cellRef.current, []);

  // attrs object stays referentially stable (refs to stable callbacks).
  const attrsRef = useRef<GridAttrs>({ onPointerMove, onPointerLeave, onPointerCancel });
  attrsRef.current = { onPointerMove, onPointerLeave, onPointerCancel };

  // Layer providers: ignore `current`, return a fresh layer each time
  // the layer is requested. Per the role taxonomy, the function shape
  // is uniform with wrappers — providers just disregard the input.
  const layers: GridLayers = {
    grid: <T,>(_current: RenderLayer<T> | null): RenderLayer<T> => {
      const o = optsRef.current;
      const layer = createGridLayer({
        spacing: o.spacing,
        unitSystem: o.unitSystem,
        bounds: o.bounds,
        accentEvery: o.accentEvery,
        subdivisions: o.subdivisions,
        style: o.style,
      });
      return layer as unknown as RenderLayer<T>;
    },
    highlight: <T,>(_current: RenderLayer<T> | null): RenderLayer<T> => {
      const o = optsRef.current;
      const layer = createCellHighlightLayer({
        spacing: o.spacing,
        unitSystem: o.unitSystem,
        origin: o.origin ? () => o.origin! : undefined,
        getCell,
        fill: o.highlightFill,
      });
      return layer as unknown as RenderLayer<T>;
    },
  };

  return {
    api: { cell, getCell },
    attrs: attrsRef.current,
    layers,
  };
}
