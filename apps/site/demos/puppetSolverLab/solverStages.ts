/**
 * The one place the lab reads the puppet solver. Main's `createArapSolver`
 * returns only its finished answer, so `step1` is null and the lab hides its
 * step toggle; when geom exposes the solver's intermediate states, this module
 * switches to that API and nothing else in the lab changes.
 */
import type { PolygonPath } from '@weasel-js/geom';
import { createArapSolver, puppetMesh, type ArapSolver, type PuppetMesh, type PuppetPin } from '@weasel-js/geom/warp';

/** The mesh a pin set deforms, and where its vertices land at each stage the solver shows. */
export interface SolverStages {
  mesh: PuppetMesh;
  /** Step one: each triangle free to scale and turn. Null while the solver keeps it to itself. */
  step1: Float64Array | null;
  /** Step two: unscaled copies fitted and averaged — what the warp uses. */
  step2: Float64Array;
}

/** Whether the solver shows its first step. */
export const STEP_ONE_SHOWN = false;

interface Rig {
  key: string;
  mesh: PuppetMesh;
  solver: ArapSolver;
}

const rigs = new WeakMap<PolygonPath, Rig>();

function rigFor(source: PolygonPath, pins: readonly PuppetPin[]): Rig {
  const key = pins.map((p) => `${p.from.x},${p.from.y}`).join(';');
  const held = rigs.get(source);
  if (held?.key === key) return held;
  const mesh = puppetMesh(source, pins.map((p) => p.from));
  const pinned = [...new Set(Array.from(mesh.pinVertex).filter((v) => v >= 0))];
  const rig = { key, mesh, solver: createArapSolver(mesh, pinned) };
  rigs.set(source, rig);
  return rig;
}

/**
 * `source` deformed by `pins`, as `puppetMap` deforms it: a pin off the
 * outline holds the outline vertex it snapped to, carried by its own drag.
 */
export function solveStages(source: PolygonPath, pins: readonly PuppetPin[]): SolverStages | null {
  if (pins.length === 0) return null;
  const { mesh, solver } = rigFor(source, pins);
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
  return { mesh, step1: null, step2: solver.solve(targets) };
}
