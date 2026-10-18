/**
 * The puppet solver run on a pin set with its trace on: the mesh, and where
 * its vertices stand after every stage — the two linear steps, each
 * local/global round, and each round of the injective pass when one runs.
 * The last step is the result `puppetMap` warps the shape by.
 */
import type { PolygonPath } from '@weasel-js/geom';
import {
  createArapSolver, puppetMesh, type ArapSolver, type ArapStage, type PuppetMesh, type PuppetPin,
} from '@weasel-js/geom/warp';

export interface TraceStep {
  stage: ArapStage;
  round: number;
  vertices: Float64Array;
}

export interface SolverTrace {
  mesh: PuppetMesh;
  steps: TraceStep[];
}

interface Rig {
  key: string;
  mesh: PuppetMesh;
  solver: ArapSolver;
  traced?: { key: string; trace: SolverTrace };
}

const rigs = new WeakMap<PolygonPath, Rig>();

function rigFor(source: PolygonPath, pins: readonly PuppetPin[]): Rig {
  const key = pins.map((p) => `${p.from.x},${p.from.y}`).join(';');
  const held = rigs.get(source);
  if (held?.key === key) return held;
  const mesh = puppetMesh(source, pins.map((p) => p.from));
  const pinned = [...new Set(Array.from(mesh.pinVertex).filter((v) => v >= 0))];
  const rig: Rig = { key, mesh, solver: createArapSolver(mesh, pinned) };
  rigs.set(source, rig);
  return rig;
}

/**
 * `source` deformed by `pins` as `puppetMap` deforms it — a pin off the
 * outline holds the outline vertex it snapped to, carried by its own drag —
 * with every step of the solve kept. Solved once per pin position.
 */
export function solverTrace(source: PolygonPath, pins: readonly PuppetPin[]): SolverTrace | null {
  if (pins.length === 0) return null;
  const rig = rigFor(source, pins);
  const { mesh, solver } = rig;
  if (mesh.triangles.length === 0) return null;
  const V = mesh.vertices;
  const targets: number[] = [];
  const seen = new Set<number>();
  pins.forEach((pin, k) => {
    const v = mesh.pinVertex[k];
    if (v < 0 || seen.has(v)) return;
    seen.add(v);
    targets.push(pin.to.x + V[2 * v] - pin.from.x, pin.to.y + V[2 * v + 1] - pin.from.y);
  });
  if (targets.length === 0) return null;
  const key = targets.join(',');
  if (rig.traced?.key === key) return rig.traced.trace;
  const steps: TraceStep[] = [];
  solver.solve(targets, { trace: (s) => steps.push({ stage: s.stage, round: s.round, vertices: Float64Array.from(s.vertices) }) });
  if (steps.length === 0) return null;
  const trace = { mesh, steps };
  rig.traced = { key, trace };
  return trace;
}
