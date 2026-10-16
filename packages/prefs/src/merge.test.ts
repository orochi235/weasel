import { describe, expect, it } from 'vitest';
import { pref } from './build';
import { prefLeaves } from './helpers';
import { mergePrefGroups } from './merge';

const ui = pref.group('Components', {
  tree: pref.group('Tree', { typeaheadMs: pref.number('Typeahead', 500) }),
  targets: pref.group('Targets', { curveHitPx: pref.number('Curve hit', 8) }, { as: 'section' }),
});
const core = pref.group('Canvas', {
  targets: pref.group('Hit targets', { handlePx: pref.number('Handle', 8) }),
  view: pref.group('View', { animationMs: pref.number('Animation', 250) }),
});

describe('mergePrefGroups', () => {
  it('holds every leaf of every group, merging groups that share a key', () => {
    const merged = mergePrefGroups('Kit', ui, core);
    expect(merged.name).toBe('Kit');
    expect([...prefLeaves(merged).keys()]).toEqual(['tree.typeaheadMs', 'targets.curveHitPx', 'targets.handlePx', 'view.animationMs']);
  });

  it("keeps the first group's own fields where two merge", () => {
    const targets = mergePrefGroups('Kit', ui, core).children.targets;
    expect(targets).toMatchObject({ name: 'Targets', as: 'section' });
  });

  it('throws on a leaf meeting anything at the same path', () => {
    const clash = pref.group('X', { tree: pref.group('Tree', { typeaheadMs: pref.number('Again', 1) }) });
    expect(() => mergePrefGroups('Kit', ui, clash)).toThrow('"tree.typeaheadMs"');
  });

  it('leaves its inputs as they were', () => {
    mergePrefGroups('Kit', ui, core);
    expect(Object.keys(ui.children.targets.children)).toEqual(['curveHitPx']);
  });
});
