/**
 * The pin warp solver run on a pin set with its trace on: the mesh, and where
 * its vertices stand after every stage — the two linear steps, each
 * local/global round, and each round of the injective pass when one runs.
 * The last step is the result `pinWarpMap` warps the shape by.
 */
import type { PolygonPath } from '@weasel-js/geom';
import { pinWarpSolve, type ArapStage, type PinWarpMesh, type WarpPin } from '@weasel-js/geom/warp';

export interface TraceStep {
  stage: ArapStage;
  round: number;
  vertices: Float64Array;
}

export interface SolverTrace {
  mesh: PinWarpMesh;
  steps: TraceStep[];
}

const traced = new WeakMap<PolygonPath, { key: string; trace: SolverTrace | null }>();

/** `source` deformed by `pins` as `pinWarpMap` deforms it, with every step of the solve kept. Solved once per pin set. */
export function solverTrace(source: PolygonPath, pins: readonly WarpPin[]): SolverTrace | null {
  const key = pins.map((p) => `${p.from.x},${p.from.y},${p.to.x},${p.to.y}`).join(';');
  const held = traced.get(source);
  if (held?.key === key) return held.trace;
  const steps: TraceStep[] = [];
  const solved = pinWarpSolve(source, pins, {
    trace: (s) => steps.push({ stage: s.stage, round: s.round, vertices: Float64Array.from(s.vertices) }),
  });
  const trace = solved && steps.length > 0 ? { mesh: solved.mesh, steps } : null;
  traced.set(source, { key, trace });
  return trace;
}
