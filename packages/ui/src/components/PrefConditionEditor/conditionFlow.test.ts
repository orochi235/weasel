import { describe, expect, it } from 'vitest';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { prefConditionFlow } from './conditionFlow';

const SCHEMA: PrefGroup = { name: 'Root', children: {
  grid: { kind: 'boolean', name: 'Show grid', description: '', default: false },
  units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }] } as PrefLeaf,
  step: { kind: 'number', name: 'Zoom step', description: '', default: 10 },
  author: { kind: 'string', name: 'Author', description: '', default: '' } as PrefLeaf,
} };

const grid: PrefCondition = { path: 'grid', is: true };
const mm: PrefCondition = { path: 'units', is: 'mm' };
const range: PrefCondition = { path: 'step', atLeast: 2, below: 64 };

const flowOf = (condition: PrefCondition | undefined) => prefConditionFlow(condition, SCHEMA);
/** Each path of a flow as `from>to`. */
const paths = (condition: PrefCondition | undefined) => flowOf(condition).edges.map((e) => `${e.from}>${e.to}`);
const lines = (condition: PrefCondition, id: string) => flowOf(condition).nodes.find((n) => n.id === id)?.lines;

describe('a condition as a flow', () => {
  it('runs straight from its first box to its last for no condition, and through the one box of a test', () => {
    expect(paths(undefined)).toEqual(['start>end']);
    expect(paths(grid)).toEqual(['start>test:0', 'test:0>end']);
  });

  it('names a test\'s box for its pref, and says each comparison as a row\'s controls do', () => {
    expect(lines(grid, 'test:0')).toEqual(['Show grid', 'is on']);
    expect(lines(mm, 'test:0')).toEqual(['Units', 'is Millimeters']);
    expect(lines(range, 'test:0')).toEqual(['Zoom step', 'is at least 2', 'is below 64']);
    expect(lines({ not: { path: 'author' } }, 'test:0')).toEqual(['Author', 'is not set']);
    expect(lines({ not: { path: 'units', in: ['px', 'mm'] } }, 'test:0')).toEqual(['Units', 'is none of Pixels, Millimeters']);
    expect(lines({ path: 'gone', is: 'x' }, 'test:0')).toEqual(['gone', "is 'x'"]);
  });

  it('stands the parts of an all in a line, and the parts of an any side by side', () => {
    expect(paths({ all: [grid, mm] })).toEqual(['start>test:0.0', 'test:0.0>test:0.1', 'test:0.1>end']);
    expect(paths({ any: [grid, mm] })).toEqual(['start>test:0.0', 'start>test:0.1', 'test:0.0>end', 'test:0.1>end']);
  });

  it('leads every way out of an any into what follows it', () => {
    expect(paths({ all: [{ any: [grid, mm] }, range] })).toEqual([
      'start>test:0.0.0', 'start>test:0.0.1', 'test:0.0.0>test:0.1', 'test:0.0.1>test:0.1', 'test:0.1>end',
    ]);
  });

  it('draws a not no comparison says as a group round what it wraps, entered and left as one box', () => {
    const flow = flowOf({ all: [grid, { not: { any: [mm, range] } }] });
    expect(flow.groups).toEqual([{ id: 'not:0.1', members: ['test:0.1.not.0', 'test:0.1.not.1'], label: 'not' }]);
    expect(flow.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['start>test:0.0', 'test:0.0>not:0.1', 'not:0.1>end']);
  });

  it('holds a not inside a not as a group inside a group', () => {
    const flow = flowOf({ not: { all: [grid, { not: { any: [mm, range] } }] } });
    expect(flow.groups.map((g) => [g.id, g.members])).toEqual([
      ['not:0.not.1', ['test:0.not.1.not.0', 'test:0.not.1.not.1']],
      ['not:0', ['test:0.not.0', 'not:0.not.1']],
    ]);
  });

  it('draws an all of nothing as the bare path, and an any of nothing as a box nothing leaves', () => {
    expect(paths({ all: [] })).toEqual(['start>end']);
    expect(paths({ all: [grid, { any: [] }] })).toEqual(['start>test:0.0', 'test:0.0>never:0.1']);
    expect(paths({ not: { all: [] } })).toEqual(['start>never:0']);
  });

  it('says what the condition decides in its last box', () => {
    expect(prefConditionFlow(grid, SCHEMA, { holds: 'shown' }).nodes.at(-1)).toEqual({ id: 'end', lines: ['shown'], outline: 'stadium' });
  });
});
