/** A server-side consumer: geometry, the snapshot codec, and an undo history, in Node with no DOM. */
import { boundsOfPath, pathFromD } from '@weasel-js/geom';
import { pathUnion } from '@weasel-js/geom/booleans';
import { createHistory, createSwapOp } from '@weasel-js/history';
import { stableStringify } from '@weasel-js/core/json';
import { polygonFromPoints } from '@weasel-js/core/math';

const checks: [string, () => boolean][] = [
  ['unions two overlapping squares', () => {
    const box = boundsOfPath(pathUnion(pathFromD('M0 0 L10 0 L10 10 L0 10 Z'), pathFromD('M5 0 L15 0 L15 10 L5 10 Z')));
    return box.x === 0 && box.y === 0 && box.width === 15 && box.height === 10;
  }],
  ['bounds a polygon built from points', () => boundsOfPath(polygonFromPoints([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }])).width === 4],
  ['writes JSON with sorted keys', () => stableStringify({ b: 1, a: { d: 2, c: 3 } }) === '{"a":{"c":3,"d":2},"b":1}'],
  ['undoes and redoes an op', () => {
    let title = 'draft';
    const history = createHistory(null);
    history.apply(createSwapOp({ name: 'title', label: 'Rename', before: 'draft', after: 'final', emit: (v: string) => { title = v; } }));
    const applied = title === 'final';
    history.undo();
    const undone = title === 'draft';
    history.redo();
    return applied && undone && title === 'final';
  }],
];

for (const [i, [name, holds]] of checks.entries()) {
  if (!holds()) throw new Error(`node consumer: ${name} did not hold`);
  console.log(`[node] ok ${i + 1}/${checks.length} ${name}`);
}
console.log('[node] passed');
