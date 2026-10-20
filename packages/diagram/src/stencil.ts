/**
 * Stencils: the shapes a palette offers, as data, and what one becomes when it
 * is drawn — a `buildBody` body whose rows are ordinary text nodes.
 */
import { createInsertOp, type Op, type RectPose } from '@weasel-js/core';
import { buildBody, type MeasureRowText, type Row } from './body';
import { DEFAULT_FONT } from './edgeLabel';
import { NODE, type DiagramSceneData, type NodeStyle } from './fromData';
import { rowTextStyle } from './rowStyle';
import type { IconRef } from '@weasel-js/icons';
import { icon } from './icons.gen';
import type { Outline } from './outline';

/** One shape a palette offers. `size` is what a click places; `rows` default
 *  to one empty label, so the body has a text node to type into. `icon` is its
 *  tool's glyph in a palette. */
export interface DiagramStencil {
  id: string;
  label: string;
  outline: Outline;
  size: { width: number; height: number };
  rows?: readonly Row[];
  icon?: IconRef;
}

/** The basic flowchart symbols. */
export const FLOWCHART_STENCILS: readonly DiagramStencil[] = [
  { id: 'process', label: 'Process', outline: 'rect', size: { width: 120, height: 60 }, icon: icon('shape:rectangle') },
  { id: 'decision', label: 'Decision', outline: 'diamond', size: { width: 120, height: 80 }, icon: icon('shape:diamond') },
  { id: 'terminal', label: 'Terminal', outline: 'stadium', size: { width: 120, height: 50 }, icon: icon('shape:stadium') },
  { id: 'data', label: 'Data', outline: 'parallelogram', size: { width: 130, height: 60 }, icon: icon('shape:parallelogram') },
  { id: 'manual', label: 'Manual', outline: 'trapezoid', size: { width: 130, height: 60 }, icon: icon('shape:trapezoidSide') },
  { id: 'preparation', label: 'Preparation', outline: 'hexagon', size: { width: 130, height: 60 }, icon: icon('shape:hexagonFlat') },
  { id: 'connector', label: 'Connector', outline: 'ellipse', size: { width: 50, height: 50 }, icon: icon('shape:circle') },
];

/** The insert kind a stencil's tool passes to the `insert` dep. */
export const stencilKind = (id: string): string => `stencil:${id}`;

/** The stencil id an insert kind names, or `null` for a kind that is no stencil's. */
export function stencilIdOf(kind: string): string | null {
  return kind.startsWith('stencil:') ? kind.slice('stencil:'.length) : null;
}

const DEFAULT_ROWS: readonly Row[] = [{ kind: 'label', text: '' }];

type Bounds = { x: number; y: number; width: number; height: number };

/** A zero-size box — a click rather than a drag — becomes the stencil's own
 *  size centered on where it landed. */
function placedBounds(stencil: DiagramStencil, b: Bounds): Bounds {
  if (b.width > 0 && b.height > 0) return b;
  const { width, height } = stencil.size;
  return { x: b.x + b.width / 2 - width / 2, y: b.y + b.height / 2 - height / 2, width, height };
}

/**
 * The ops that insert `stencil` at `bounds`: its container first, then one
 * text node per text row. Applied as one batch, they are one undo entry.
 * `style` colors the body and its text; default `diagramScene`'s node style.
 * `font` is the face its text rows fall back on; default 12px sans-serif.
 * `parent` is the container the body goes in; default the top level.
 */
export function stencilBuild<TLayer extends string>(
  stencil: DiagramStencil,
  bounds: Bounds,
  opts: {
    layer: TLayer; newId: () => string; measure?: MeasureRowText; style?: NodeStyle;
    font?: { fontFamily: string; fontSize: number }; parent?: string | null;
  },
): { id: string; ops: Op[] } {
  const id = opts.newId();
  const style = opts.style ?? NODE;
  const at = placedBounds(stencil, bounds);
  const built = buildBody<DiagramSceneData, TLayer, RectPose>(
    { outline: stencil.outline, rows: stencil.rows ?? DEFAULT_ROWS },
    at,
    {
      id,
      layer: opts.layer,
      ...(opts.measure ? { measure: opts.measure } : {}),
      body: (trait) => ({
        diagram: trait,
        fill: { paint: { color: style.fill } },
        stroke: { paint: { color: style.stroke }, width: style.strokeWidth ?? 2, ...(style.dash ? { dash: style.dash } : {}) },
      }),
      row: (text, box) => box.row.kind === 'label' || box.row.kind === 'field'
        ? {
            text,
            style: rowTextStyle(box.row, opts.font ?? DEFAULT_FONT),
            fill: { paint: { color: style.text } },
          }
        : null,
    },
  );
  const ops = built.specs.map((spec, k) => createInsertOp({
    node: { ...spec, id: spec.id ?? `${id}/${k}`, parent: spec.parent ?? opts.parent ?? null },
    label: `Insert ${stencil.label}`,
  }));
  return { id, ops };
}
