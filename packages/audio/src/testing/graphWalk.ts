import type { FakeNode } from './fakeAudioContext';

/** Every acyclic path from `from` to `to` along `connectedTo`. */
export function allPaths(from: FakeNode, to: FakeNode): FakeNode[][] {
  const out: FakeNode[][] = [];
  const walk = (n: FakeNode, path: FakeNode[]): void => {
    if (n === to) { out.push(path); return; }
    for (const next of n.connectedTo) {
      if (!path.includes(next)) walk(next, [...path, next]);
    }
  };
  walk(from, [from]);
  return out;
}

/** Whether any cycle is reachable from `from`. Web Audio mutes a cycle with no
 *  `DelayNode` in it, so a transition that forms one drops out mid-fade. */
export function reachesCycle(from: FakeNode): boolean {
  const onStack = new Set<FakeNode>();
  const done = new Set<FakeNode>();
  const visit = (n: FakeNode): boolean => {
    if (onStack.has(n)) return true;
    if (done.has(n)) return false;
    onStack.add(n);
    for (const next of n.connectedTo) if (visit(next)) return true;
    onStack.delete(n);
    done.add(n);
    return false;
  };
  return visit(from);
}
