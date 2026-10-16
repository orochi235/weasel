import { describe, expect, it } from 'vitest';
import { checkPipeline } from './check';
import type { EffectPipeline } from './types';

const OK: EffectPipeline = {
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }, { id: 'radius', type: 'number' }], outputs: [{ id: 'out', type: 'image' }] },
  ],
  wires: [{ from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } }],
  groups: [{ id: 'g', members: ['blur'] }],
};
const kinds = (p: EffectPipeline) => checkPipeline(p).map((x) => x.kind);
const wire = (from: [string, string], to: [string, string]) =>
  ({ from: { stage: from[0], port: from[1] }, to: { stage: to[0], port: to[1] } });

describe('checkPipeline', () => {
  it('finds nothing wrong with a sound pipeline', () => {
    expect(checkPipeline(OK)).toEqual([]);
  });

  it('names a wire whose stage or port is missing, by its index', () => {
    const p = { ...OK, wires: [...OK.wires, wire(['nope', 'out'], ['blur', 'image']), wire(['src', 'out'], ['blur', 'nope'])] };
    expect(checkPipeline(p).map((x) => [x.kind, x.wire])).toEqual([['missing-stage', 1], ['missing-port', 2]]);
  });

  it('names a wire that starts at an input or ends at an output', () => {
    expect(kinds({ ...OK, wires: [wire(['blur', 'image'], ['blur', 'radius'])] })).toEqual(['wrong-direction']);
    expect(kinds({ ...OK, wires: [wire(['src', 'out'], ['blur', 'out'])] })).toEqual(['wrong-direction']);
  });

  it('names a wire joining two types', () => {
    expect(kinds({ ...OK, wires: [wire(['src', 'out'], ['blur', 'radius'])] })).toEqual(['type-mismatch']);
  });

  it('names a repeated stage id and a repeated port id', () => {
    expect(kinds({ ...OK, stages: [...OK.stages, OK.stages[0]!] })).toEqual(['duplicate-stage']);
    const twice = { id: 'x', title: 'X', inputs: [{ id: 'a', type: 'image' }], outputs: [{ id: 'a', type: 'image' }] };
    expect(kinds({ stages: [twice], wires: [] })).toEqual(['duplicate-port']);
  });

  it('names a group member that does not exist', () => {
    expect(kinds({ ...OK, groups: [{ id: 'g', members: ['blur', 'ghost'] }] })).toEqual(['missing-member']);
  });

  it('accepts a group that holds another group', () => {
    expect(kinds({ ...OK, groups: [{ id: 'inner', members: ['blur'] }, { id: 'outer', members: ['inner'] }] })).toEqual([]);
  });

  it('names a split with a missing input, cuts out of order, or the wrong number of outputs', () => {
    const split = (over: object) => ({
      id: 'gate', title: 'Gate', kind: 'decision',
      inputs: [{ id: 'x', type: 'number' }],
      outputs: [{ id: 'lo', type: 'number' }, { id: 'hi', type: 'number' }],
      split: { input: 'x', at: [0.5] },
      ...over,
    });
    expect(kinds({ stages: [split({})], wires: [] })).toEqual([]);
    expect(kinds({ stages: [split({ split: { input: 'y', at: [0.5] } })], wires: [] })).toEqual(['bad-split']);
    expect(kinds({ stages: [split({ split: { input: 'x', at: [0.8, 0.2] } })], wires: [] })).toEqual(['bad-split']);
    expect(kinds({ stages: [split({ split: { input: 'x', at: [0.2, 0.8] } })], wires: [] })).toEqual(['bad-split']);
    expect(kinds({ stages: [split({ split: { input: 'x', at: [] } })], wires: [] })).toEqual(['bad-split']);
  });

  it('names a group whose id repeats an earlier group\'s, or is a stage\'s', () => {
    const again = checkPipeline({ ...OK, groups: [{ id: 'g', members: ['blur'] }, { id: 'g', members: ['src'] }] });
    expect(again.map((x) => [x.kind, x.group])).toEqual([['duplicate-group', 'g']]);
    const stage = checkPipeline({ ...OK, groups: [{ id: 'blur', members: ['src'] }] });
    expect(stage.map((x) => [x.kind, x.group])).toEqual([['duplicate-group', 'blur']]);
  });

  it('names a cut that is not a finite number', () => {
    const gate = {
      id: 'gate', title: 'Gate', kind: 'decision',
      inputs: [{ id: 'x', type: 'number' }],
      outputs: [{ id: 'lo', type: 'number' }, { id: 'hi', type: 'number' }],
      split: { input: 'x', at: [Number.NaN] },
    };
    expect(checkPipeline({ stages: [gate], wires: [] }).map((x) => [x.kind, x.stage])).toEqual([['bad-split', 'gate']]);
    expect(kinds({ stages: [{ ...gate, split: { input: 'x', at: [Infinity] } }], wires: [] })).toEqual(['bad-split']);
  });

  it('says which stage, port, wire or group each problem is about', () => {
    const where = (p: EffectPipeline) => checkPipeline(p).map(({ message: _message, ...rest }) => rest);
    expect(where({ ...OK, wires: [wire(['nope', 'out'], ['blur', 'image'])] }))
      .toEqual([{ kind: 'missing-stage', wire: 0, stage: 'nope' }]);
    expect(where({ ...OK, wires: [wire(['src', 'out'], ['blur', 'nope'])] }))
      .toEqual([{ kind: 'missing-port', wire: 0, stage: 'blur', port: 'nope' }]);
    expect(where({ ...OK, wires: [wire(['src', 'out'], ['blur', 'out'])] }))
      .toEqual([{ kind: 'wrong-direction', wire: 0, stage: 'blur', port: 'out' }]);
    expect(where({ ...OK, wires: [wire(['src', 'out'], ['blur', 'radius'])] }))
      .toEqual([{ kind: 'type-mismatch', wire: 0 }]);
    expect(where({ ...OK, stages: [...OK.stages, OK.stages[0]!] }))
      .toEqual([{ kind: 'duplicate-stage', stage: 'src' }]);
    const twice = { id: 'x', title: 'X', inputs: [{ id: 'a', type: 'image' }], outputs: [{ id: 'a', type: 'image' }] };
    expect(where({ stages: [twice], wires: [] })).toEqual([{ kind: 'duplicate-port', stage: 'x', port: 'a' }]);
    expect(where({ ...OK, groups: [{ id: 'g', members: ['blur', 'ghost'] }] }))
      .toEqual([{ kind: 'missing-member', group: 'g' }]);
    expect(where({ ...OK, groups: [{ id: 'g', members: ['blur'] }, { id: 'g', members: ['src'] }] }))
      .toEqual([{ kind: 'duplicate-group', group: 'g' }]);
    const gate = { id: 'gate', title: 'Gate', kind: 'decision', inputs: [{ id: 'x', type: 'number' }], split: { input: 'y', at: [0.5] } };
    expect(where({ stages: [gate], wires: [] })).toEqual([{ kind: 'bad-split', stage: 'gate' }]);
  });

  it('does not throw on an empty pipeline', () => {
    expect(checkPipeline({ stages: [], wires: [] })).toEqual([]);
  });
});
