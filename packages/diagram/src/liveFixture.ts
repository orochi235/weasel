/** Test fixture for live layout runs: a scattered scene and a manual clock. */
import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { buildGraph, type Graph } from './graph';
import { sceneParticipants } from './portLayer';

const LAYERS = [{ id: 'main' as const }];
export const box = (x: number, y: number, w = 40, h = 20): RectPose => ({ x, y, width: w, height: h });

/** Three boxes and two edges, scattered. */
export function scene() {
  const s = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const a = s.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: { diagram: {} } });
  const b = s.add({ kind: 'container', layer: 'main', pose: box(200, 30), data: { diagram: {} } });
  const c = s.add({ kind: 'leaf', layer: 'main', pose: box(60, 180), data: { diagram: {} } });
  const edge = (from: NodeId, to: NodeId) => s.add({
    kind: 'leaf', layer: 'main', pose: box(0, 0, 0, 0),
    data: { diagram: { from: {}, to: {} } },
    dependsOn: [from, to],
  });
  edge(a, b);
  edge(b, c);
  return { scene: s, a, b, c };
}

export const graphOf = (s: ReturnType<typeof scene>['scene']): Graph =>
  buildGraph(sceneParticipants<RectPose>(s as never));

/** Manual rAF driver. */
export function makeClock() {
  let next = 1;
  const callbacks = new Map<number, (t: number) => void>();
  return {
    requestFrame: (cb: (t: number) => void): number => {
      const h = next++;
      callbacks.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
    frames(n: number) {
      for (let i = 0; i < n; i++) {
        const due = [...callbacks.values()];
        callbacks.clear();
        for (const cb of due) cb(0);
      }
    },
  };
}
