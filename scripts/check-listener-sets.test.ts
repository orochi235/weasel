import { describe, expect, it } from 'vitest';
import { listenerSetLines } from './check-listener-sets.mjs';

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
      'const stops = new Map<string, () => void>();',
      'const offs: Array<() => void> = [];',
    ].join('\n');
    expect(listenerSetLines(source)).toEqual([]);
  });

  it('catches a set of functions declared rather than built', () => {
    expect(listenerSetLines('interface H {\n  listeners: Set<(id: string) => void>;\n}\n')).toEqual([2]);
    expect(listenerSetLines('const subs = useRef<ReadonlySet<Listener>>(new Set());\n')).toEqual([1]);
  });

  it('catches listeners filed by key, in a set or an array per key', () => {
    expect(listenerSetLines('const a = new Map<string, Set<() => void>>();\n')).toEqual([1]);
    expect(listenerSetLines('const b = new Map<number, (() => void)[]>();\n')).toEqual([1]);
    expect(listenerSetLines('const c = new WeakMap<object, Array<(e: E) => void>>();\n')).toEqual([1]);
  });

  it('catches an array of a type named for a listener', () => {
    expect(listenerSetLines('const a: Listener[] = [];\nconst b: Array<ChangeSubscriber> = [];\n')).toEqual([1, 2]);
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
