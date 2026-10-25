import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefLeaf } from './schema';
import { applyPrefConditions, prefJudge } from './scope';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;

const stroke = {
  kind: 'object', name: 'Stroke', description: '', default: {},
  children: { width: num('Width'), miter: num('Miter', { showIf: { path: 'on' } }) },
} as PrefLeaf;
const schema: PrefGroup = {
  name: '',
  children: {
    on: flag('On'),
    size: num('Size', { showIf: { path: 'on' } }),
    lock: num('Lock', { enableIf: { path: 'on' } }),
    grid: { name: 'Grid', showIf: { path: 'on' }, children: { fine: num('Fine'), inner: { name: 'Inner', children: { step: num('Step') } } } },
    stroke,
    phases: { kind: 'list', name: 'Phases', description: '', default: [], item: stroke } as PrefLeaf,
  },
};
const judge = (values: unknown) => prefJudge(schema, (path) => prefValueAtPath(values, path));

describe('applyPrefConditions keeping what a showIf hides', () => {
  it('drops nothing, and names the path of every leaf, field, and group that is hidden', () => {
    const applied = applyPrefConditions(schema, judge({ on: false }), { keepHidden: true });
    expect(applied.shown).toBe(schema);
    expect([...applied.hidden]).toEqual(['size', 'grid', 'grid.fine', 'grid.inner', 'grid.inner.step', 'stroke.miter', 'phases.*.miter']);
  });

  it('still names what is disabled', () => {
    expect([...applyPrefConditions(schema, judge({ on: false }), { keepHidden: true }).disabled]).toEqual(['lock']);
  });

  it('names nothing while every showIf holds, and nothing when it drops what is hidden', () => {
    expect(applyPrefConditions(schema, judge({ on: true }), { keepHidden: true }).hidden.size).toBe(0);
    const dropped = applyPrefConditions(schema, judge({ on: false }));
    expect(dropped.hidden.size).toBe(0);
    expect(Object.keys(dropped.shown!.children)).toEqual(['on', 'lock', 'stroke', 'phases']);
  });

  it('keeps a hidden root', () => {
    const root: PrefGroup = { name: '', showIf: { path: 'on' }, children: { on: flag('On') } };
    const applied = applyPrefConditions(root, prefJudge(root, () => false), { keepHidden: true });
    expect(applied.shown).toBe(root);
    expect([...applied.hidden]).toEqual(['on']);
  });

  it('names a hidden section by its section path, and the leaves under it', () => {
    const section: PrefSection = {
      name: '',
      members: { 'data.on': flag('On'), look: { name: 'Look', showIf: { path: 'data.on' }, members: { 'data.fill': num('Fill'), 'data.stroke': stroke } } },
    };
    const applied = applyPrefConditions(section, prefJudge(section, () => false), { keepHidden: true });
    expect(applied.shown).toBe(section);
    expect([...applied.hidden]).toEqual(['#look', 'data.fill', 'data.stroke', 'data.stroke.width', 'data.stroke.miter']);
  });

  it('keeps an empty group when told to, as before', () => {
    const only: PrefGroup = { name: '', children: { a: { name: 'A', children: { x: num('X', { showIf: { path: 'on' } }) } } } };
    const held = prefJudge(only, () => false);
    expect(Object.keys(applyPrefConditions(only, held).shown!.children)).toEqual([]);
    expect(Object.keys(applyPrefConditions(only, held, { keepEmpty: true }).shown!.children)).toEqual(['a']);
  });
});
