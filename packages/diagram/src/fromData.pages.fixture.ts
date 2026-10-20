/** Data for `fromData.pages.test.ts`'s check that a diagram with no pages draws what it drew before pages existed. */
import type { DiagramData } from './dataTypes';

export const BASELINE_DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['level mix', '0–1'] },
    { id: 'b', lines: ['warm'] },
    { id: 'c', lines: ['color', 'hex'] },
    { id: 'd', lines: ['in region'] },
  ],
  edges: [{ from: 'a', to: 'b', label: 'weight' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'g', to: 'a' }],
  groups: [{ id: 'g', members: ['b', 'c'], label: 'pair' }],
  containers: [{ id: 'r', role: 'container', label: 'region', members: ['d'] }],
};

/** Specs as plain JSON, a function standing as its name. */
export const serialize = (specs: unknown): unknown =>
  JSON.parse(JSON.stringify(specs, (_k, v: unknown) => (typeof v === 'function' ? `[fn ${(v as { name: string }).name}]` : v)));
