/**
 * The scenes the visibility bench draws: a grid of rect marks flat under the
 * roots, the same count nested as 10 groups of 10 groups of 1000, and small
 * all-on-screen grids. Poses are local, as the default composition reads them.
 */
import { createScene, type NodeId, type Scene } from '@weasel-js/core';

export type Pose = { x: number; y: number; width: number; height: number };
export type Data = { shape?: 'rect' };
export type BenchScene = Scene<Data, 'main', Pose>;

/** World units between neighboring marks in the large scenes. */
export const PITCH = 10;

type Spec = { id: NodeId; kind: 'mark' | 'group'; layer: 'main'; pose: Pose; data: Data; parent?: NodeId };

/** A scene holding `specs` from the start, as a loaded document does: no history, one build. */
export function sceneOf(specs: readonly Spec[]): BenchScene {
  return createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }], historyLimit: 50, initial: specs as never });
}

let minted = 0;
const idOf = (): NodeId => `b${(minted++).toString(36)}` as NodeId;

const mark = (x: number, y: number, size: number, parent?: NodeId): Spec =>
  ({ id: idOf(), kind: 'mark', layer: 'main', pose: { x, y, width: size, height: size }, data: { shape: 'rect' }, ...(parent ? { parent } : {}) });

/** `cols × rows` marks at `pitch`, flat under the roots. */
export function flatGrid(cols: number, rows: number, pitch = PITCH): { scene: BenchScene; ids: NodeId[] } {
  const specs: Spec[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) specs.push(mark(c * pitch, r * pitch, pitch * 0.6));
  return { scene: sceneOf(specs), ids: specs.map((s) => s.id) };
}

/** 10 bands of 10 blocks of 1000 marks: a top group per band, a group per block, each block 32 marks wide. */
export function nestedGrid(): { scene: BenchScene; ids: NodeId[]; groups: NodeId[] } {
  const specs: Spec[] = [];
  const ids: NodeId[] = [];
  const groups: NodeId[] = [];
  const block = 32 * PITCH;
  for (let g = 0; g < 10; g++) {
    const top: Spec = { id: idOf(), kind: 'group', layer: 'main', pose: { x: 0, y: g * block, width: 10 * block, height: block }, data: {} };
    specs.push(top);
    groups.push(top.id);
    for (let s = 0; s < 10; s++) {
      const sub: Spec = { id: idOf(), kind: 'group', layer: 'main', pose: { x: s * block, y: 0, width: block, height: block }, data: {}, parent: top.id };
      specs.push(sub);
      groups.push(sub.id);
      for (let k = 0; k < 1000; k++) {
        const m = mark((k % 32) * PITCH, Math.floor(k / 32) * PITCH, PITCH * 0.6, sub.id);
        specs.push(m);
        ids.push(m.id);
      }
    }
  }
  return { scene: sceneOf(specs), ids, groups };
}
