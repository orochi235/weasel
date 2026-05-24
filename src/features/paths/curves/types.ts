import type { PolygonPath } from '../types';

/** A point in the shared anchor set. Every representation reads only the
 *  fields it cares about: cubic Bezier reads inHandle/outHandle; NURBS
 *  reads weight; Spiro reads spiroType. Edits to position propagate to
 *  every representation; edits to per-rep fields only affect that rep. */
export interface SharedAnchor {
  x: number;
  y: number;
  /** Cubic Bezier tangent handles in world coords. Default undefined =
   *  smooth (handles auto-derived from neighbors). */
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
  /** NURBS rational weight. Default 1 (non-rational B-spline). Clamped
   *  ≥ 1e-3 by the UI. */
  weight?: number;
  /** Spiro continuity class at this anchor. Default 'g2-smooth'. */
  spiroType?: 'corner' | 'g2-smooth' | 'g4-smooth';
}

export type CurveRepKind = 'bezierCubic' | 'bezierQuadratic' | 'nurbs' | 'spiro';

/** A user-facing control surfaced by a representation. Rendered uniformly
 *  by the demo's panel sidebar. */
export type Discriminator =
  | { kind: 'slider'; label: string; anchorIndex: number; field: string;
      min: number; max: number; step: number; value: number }
  | { kind: 'enum'; label: string; anchorIndex: number; field: string;
      options: readonly string[]; value: string }
  | { kind: 'handle'; anchorIndex: number; which: 'in' | 'out' };

/** A curve representation. Same anchor set rendered four ways. */
export interface CurveRepresentation {
  kind: CurveRepKind;
  label: string;
  /** Evaluate the curve at parameter `t ∈ [0, 1]`. */
  evaluate(anchors: SharedAnchor[], t: number): { x: number; y: number };
  /** Convert anchors to a kit PolygonPath for the renderer. */
  toPath(anchors: SharedAnchor[]): PolygonPath;
  /** Signed local curvature at parameter `t`. Drives the curvature-comb
   *  overlay; positive curls left, negative curls right. */
  curvatureAt(anchors: SharedAnchor[], t: number): number;
  /** Per-rep controls (handle drag enables, weight sliders, type pickers). */
  discriminators(anchors: SharedAnchor[]): Discriminator[];
}
