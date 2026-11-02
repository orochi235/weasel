import { describe, expect, it } from 'vitest';
import { listenerSetLines, offendingLines } from './check-listener-sets.mjs';

describe('listenerSetLines', () => {
  it('catches a set of no-argument listeners', () => {
    expect(listenerSetLines('const a = 1;\nconst listeners = new Set<() => void>();\n')).toEqual([2]);
  });

  it('catches a set of listeners that take arguments', () => {
    expect(listenerSetLines('const l = new Set<(rootId: string, areas: Area[]) => void>();\n')).toEqual([1]);
    expect(listenerSetLines('const l = new Set<(...args: TArgs) => void>();\n')).toEqual([1]);
  });

  it('catches a set of a type named for a listener', () => {
    expect(listenerSetLines('const a = new Set<Listener>();\nconst b = new Set<ChangeSubscriber>();\n')).toEqual([1, 2]);
  });

  it('leaves sets of anything else alone', () => {
    const source = [
      'const ids = new Set<string>();',
      'const seen = new Set<NodeId>();',
      'const states = new Set<TargetState>();',
      'const listenerIds = new Set<ListenerId>();',
      'const fns: Set<() => void> = createEmitter();',
    ].join('\n');
    expect(listenerSetLines(source)).toEqual([]);
  });

  it('ignores one in a comment', () => {
    const source = [
      '// const listeners = new Set<() => void>();',
      '/** Replaces a `new Set<() => void>()`. */',
      'const listeners = createEmitter();',
    ].join('\n');
    expect(listenerSetLines(source)).toEqual([]);
  });
});

describe('offendingLines', () => {
  it('reports every use in a file that is not allowlisted', () => {
    expect(offendingLines([3, 9])).toEqual([3, 9]);
  });

  it('lets an allowlisted file keep the uses its entry covers', () => {
    expect(offendingLines([3], 1)).toEqual([]);
  });

  it('reports an allowlisted file that gained a use', () => {
    expect(offendingLines([3, 9], 1)).toEqual([3, 9]);
  });
});
