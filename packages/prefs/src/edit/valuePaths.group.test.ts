import { describe, expect, it } from 'vitest';
import { checkPrefConditions, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { rebaseValuePaths } from './valuePaths';

const flag = (name: string, more: object = {}): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false, ...more });

const feature: PrefGroup = { name: 'Feature', children: { on: flag('On'), axis: flag('Axis', { enableIf: { from: 'group', path: 'on' } }) } };
const ROOT: PrefGroup = { name: 'Root', children: { on: flag('Root on'), view: { name: 'View', children: { feature } } } };

const axisOf = (root: PrefGroup): PrefLeaf =>
  ((root.children.view as PrefGroup).children.feature as PrefGroup).children.axis as PrefLeaf;

describe('a test that reads from its group, as the schema is edited', () => {
  it('follows a renamed leaf of the same group', () => {
    const next = rebaseValuePaths(ROOT, [['view.feature.on', 'view.feature.enabled']]);
    expect(axisOf(next).enableIf).toEqual({ from: 'group', path: 'enabled' });
  });

  it('is left alone by a move of the group itself, or of a root leaf of the same name', () => {
    const moved = rebaseValuePaths(ROOT, [['view.feature', 'view.other']]);
    expect(axisOf(moved).enableIf).toEqual({ from: 'group', path: 'on' });
    const rooted = rebaseValuePaths(ROOT, [['on', 'off']]);
    expect(axisOf(rooted).enableIf).toEqual({ from: 'group', path: 'on' });
  });
});

describe('checkPrefConditions with a group test', () => {
  it('finds the leaf in the group, and reports one missing there by the path it reads', () => {
    expect(checkPrefConditions(ROOT)).toEqual([]);
    const missing: PrefGroup = { name: 'Root', children: { feature: { name: 'F', children: { axis: flag('Axis', { enableIf: { from: 'group', path: 'gone' } }) } } } };
    expect(checkPrefConditions(missing).map((p) => [p.code, p.path])).toEqual([['no-leaf', 'feature.gone']]);
  });
});
