import { describe, expect, it } from 'vitest';
import { pref } from './build';
import { prefConditionInGroup } from './condition';
import { resolvePrefGroupConditions } from './groupConditions';
import type { PrefGroup } from './groups';
import { prefValueAt } from './helpers';
import { applyPrefConditions, prefJudge, prefReader, prefStatusAt } from './status';

/** A feature's settings, its axis gated on its own switch, written with no knowledge of where it is mounted. */
const feature = pref.group('Feature', {
  on: pref.boolean('On', false),
  axis: pref.enum('Axis', 'x', ['x', 'y'], { enableIf: { from: 'group', path: 'on' } }),
});

const app: PrefGroup = pref.group('App', {
  view: pref.group('View', { feature, on: pref.boolean('View on', true) }),
});

const judge = (schema: PrefGroup, values: unknown) => prefJudge(schema, prefReader(schema, values));

describe('prefConditionInGroup', () => {
  it('reads a group test under the group, and leaves the rest as they were', () => {
    expect(prefConditionInGroup({ from: 'group', path: 'on', is: true }, 'view.feature')).toEqual({ path: 'view.feature.on', is: true });
    expect(prefConditionInGroup({ from: 'group', path: 'on' }, '')).toEqual({ path: 'on' });
    const rooted = { path: 'view.on' };
    expect(prefConditionInGroup(rooted, 'view.feature')).toBe(rooted);
    const inEntry = { from: 'item' as const, path: 'mode' };
    expect(prefConditionInGroup({ any: [inEntry, { not: { from: 'group', path: 'on' } }] }, 'g')).toEqual({ any: [inEntry, { not: { path: 'g.on' } }] });
  });
});

describe('resolvePrefGroupConditions', () => {
  it('reads a test from the group its node is declared in, wherever the group is mounted', () => {
    const resolved = resolvePrefGroupConditions(app);
    const axis = prefValueAt(resolved, 'children.view.children.feature.children.axis') as { enableIf: unknown };
    expect(axis.enableIf).toEqual({ path: 'view.feature.on' });
  });

  it('hands back the same object for the same schema, and the schema itself with nothing to resolve', () => {
    expect(resolvePrefGroupConditions(app)).toBe(resolvePrefGroupConditions(app));
    const plain = pref.group('Plain', { a: pref.boolean('A', false, { enableIf: { path: 'b' } }), b: pref.boolean('B', true) });
    expect(resolvePrefGroupConditions(plain)).toBe(plain);
  });

  it("reads an object leaf's fields and a list's item in the group that holds the leaf", () => {
    const schema = {
      name: '',
      children: {
        g: {
          name: '',
          children: {
            on: { kind: 'boolean', name: 'On', description: '', default: false },
            box: { kind: 'object', name: 'Box', description: '', default: {}, children: {
              w: { kind: 'number', name: 'W', description: '', default: 0, enableIf: { from: 'group', path: 'on' } },
            } },
            rows: { kind: 'list', name: 'Rows', description: '', default: [], item: {
              kind: 'number', name: 'Row', description: '', default: 0, showIf: { from: 'group', path: 'on' },
            } },
          },
        },
      },
    } as unknown as PrefGroup;
    const resolved = resolvePrefGroupConditions(schema);
    expect(prefValueAt(resolved, 'children.g.children.box.children.w.enableIf')).toEqual({ path: 'g.on' });
    expect(prefValueAt(resolved, 'children.g.children.rows.item.showIf')).toEqual({ path: 'g.on' });
  });
});

describe('status with group tests', () => {
  it('disables the axis while its own group is off, not while a root leaf of the same name is', () => {
    const offHere = { view: { on: true, feature: { on: false } } };
    const onHere = { view: { on: false, feature: { on: true } } };
    expect(prefStatusAt(app, 'view.feature.axis', judge(app, offHere)).enabled).toBe(false);
    expect(prefStatusAt(app, 'view.feature.axis', judge(app, onHere)).enabled).toBe(true);
    expect(applyPrefConditions(app, judge(app, offHere)).disabled.has('view.feature.axis')).toBe(true);
    expect(applyPrefConditions(app, judge(app, onHere)).disabled.has('view.feature.axis')).toBe(false);
  });
});
