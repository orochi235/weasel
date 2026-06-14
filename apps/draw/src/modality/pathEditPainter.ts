/**
 * Path-edit decoration painter — anchor dots and handle lines.
 *
 * Emits `DrawCommand[]` (kit renderer vocabulary) for every anchor of the
 * target path: tangent lines from anchor → control handles, small filled
 * circles for control handle endpoints, and larger filled squares/circles
 * for the anchor dots themselves.
 *
 * All draw commands use `kind: 'path'` with `PolygonPath` shapes — that is
 * the only concrete draw vocabulary the kit renderer supports. Circles are
 * approximated as 12-segment polygons (matching the existing
 * `createAnchorEditOverlayLayer` in `src/interactions/actions/edit-anchors/overlay.ts`).
 *
 * Anchor data shape follows `PathAnchor` from the kit
 * (`src/interactions/actions/edit-anchors/geometry.ts`):
 *   - on-curve point: `{ x, y }`
 *   - incoming control: `controlIn?: { x, y }` (the kit calls these
 *     `controlIn`/`controlOut`, NOT `handleIn`/`handleOut`)
 *
 * The return type is typed as `ModeDrawCommand[]` (= `unknown[]`) so this
 * module does not import across the kit/app boundary via internal paths.
 * The wiring layer (Task 18) casts to `DrawCommand[]` at the call site.
 */

import type { ModeDrawCommand } from '@weasel-js/modes';
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type PolygonPath,
} from '@weasel-js/core';

/** Control handle descriptor — matches the shape of PathAnchor.controlIn/controlOut. */
export interface AnchorControl {
  x: number;
  y: number;
}

/**
 * An anchor on a path being edited. Follows the kit's `PathAnchor` shape
 * (fields `controlIn`/`controlOut`, NOT `handleIn`/`handleOut`).
 */
export interface Anchor {
  x: number;
  y: number;
  controlIn?: AnchorControl;
  controlOut?: AnchorControl;
}

export interface CreatePathEditPainterOptions {
  /** Returns the id of the path node currently being edited, or null. */
  getTargetId: () => string | null;
  /** Returns the anchor list for a given path node id. */
  getAnchors: (pathId: string) => readonly Anchor[];
}

// ─── Visual constants ────────────────────────────────────────────────────────

const CIRCLE_SEGMENTS = 12;
const ANCHOR_RADIUS = 4;
const CONTROL_RADIUS = 3;
const ANCHOR_FILL = '#ffffff';
const ANCHOR_STROKE = '#1a130d';
const CONTROL_FILL = '#1a130d';
const CONTROL_STROKE = '#ffffff';
const TANGENT_STROKE = '#888888';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function circlePath(cx: number, cy: number, r: number): PolygonPath {
  const n = CIRCLE_SEGMENTS;
  const commands = new Uint8Array(n + 1); // n commands + Z
  const coords = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    coords[i * 2] = cx + Math.cos(theta) * r;
    coords[i * 2 + 1] = cy + Math.sin(theta) * r;
    commands[i] = i === 0 ? PATH_M : PATH_L;
  }
  commands[n] = PATH_Z;
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

function linePath(x1: number, y1: number, x2: number, y2: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([x1, y1, x2, y2]),
    fillRule: 'nonzero',
  };
}

// ─── Painter factory ─────────────────────────────────────────────────────────

/**
 * Creates a decoration painter for path-edit mode.
 *
 * Returns a thunk `() => ModeDrawCommand[]`. Call it on each render cycle;
 * it reads the current target id and anchor positions from the provided
 * accessors, so it always reflects live state without needing to be
 * re-created when the selection changes.
 */
export function createPathEditPainter(
  opts: CreatePathEditPainterOptions,
): () => ModeDrawCommand[] {
  return (): ModeDrawCommand[] => {
    const id = opts.getTargetId();
    if (id == null) return [];

    const anchors = opts.getAnchors(id);
    const out: ModeDrawCommand[] = [];

    // Pass 1: tangent lines (anchor → control handle).
    for (const a of anchors) {
      for (const ctrl of [a.controlIn, a.controlOut]) {
        if (!ctrl) continue;
        out.push({
          kind: 'path',
          path: linePath(a.x, a.y, ctrl.x, ctrl.y),
          stroke: { paint: { color: TANGENT_STROKE }, width: 1 },
        });
      }
    }

    // Pass 2: control handle dots (drawn before anchors so anchors sit on top).
    for (const a of anchors) {
      for (const ctrl of [a.controlIn, a.controlOut]) {
        if (!ctrl) continue;
        out.push({
          kind: 'path',
          path: circlePath(ctrl.x, ctrl.y, CONTROL_RADIUS),
          fill: { color: CONTROL_FILL },
          stroke: { paint: { color: CONTROL_STROKE }, width: 1 },
        });
      }
    }

    // Pass 3: anchor dots.
    for (const a of anchors) {
      out.push({
        kind: 'path',
        path: circlePath(a.x, a.y, ANCHOR_RADIUS),
        fill: { color: ANCHOR_FILL },
        stroke: { paint: { color: ANCHOR_STROKE }, width: 1 },
      });
    }

    return out;
  };
}
