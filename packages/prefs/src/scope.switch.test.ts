import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefLeaf } from './schema';
import { applyPrefConditions, prefJudge, prefScopeAt } from './scope';

const bool = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;

const over = (values: unknown) => prefJudge({ name: '', children: {} }, (path) => prefValueAtPath(values, path));

const effects: PrefGroup = {
  name: 'Effects',
  children: {
    on: bool('Effects on'),
    shadow: {
      name: 'Shadow',
      as: 'panel',
      enableIf: { all: [{ path: 'shadow.on' }, { path: 'shadow.inner.on' }] },
      children: {
        on: bool('Shadow on', { heading: true }),
        blur: num('Blur'),
        inner: { name: 'Inner', children: { on: bool('Inner on') } },
      },
    },
    glow: {
      name: 'Glow',
      enableIf: { path: 'on' },
      children: { on: bool('Glow on', { heading: true }) },
    },
  },
};

describe("a node's enableIf and the leaves it reads", () => {
  const off = over({ on: true, shadow: { on: false, inner: { on: true } }, glow: { on: true } });

  it('disables everything in the group but the leaf directly in it that the condition reads', () => {
    const { disabled } = applyPrefConditions(effects, off);
    expect([...disabled].sort()).toEqual(['shadow', 'shadow.blur', 'shadow.inner', 'shadow.inner.on']);
    expect(prefScopeAt(effects, 'shadow.on', off).enabled).toBe(true);
    expect(prefScopeAt(effects, 'shadow.blur', off).enabled).toBe(false);
  });

  it('spares only that leaf: one deeper, one the condition does not read, and one under a failed group above stay disabled', () => {
    expect(prefScopeAt(effects, 'shadow.inner.on', off).enabled).toBe(false);
    const allOff = over({ on: false, glow: { on: true } });
    expect(applyPrefConditions(effects, allOff).disabled.has('glow.on')).toBe(true);
    const outer: PrefGroup = { name: 'Root', enableIf: { path: 'never' }, children: { effects } };
    const judge = over({ effects: { on: true } });
    expect(prefScopeAt(outer, 'effects.shadow.on', judge).enabled).toBe(false);
    expect(applyPrefConditions(outer, judge).disabled.has('effects.shadow.on')).toBe(true);
  });

  it('keeps a hidden group hidden', () => {
    const hidden: PrefGroup = { ...effects, children: { ...effects.children, glow: { ...(effects.children.glow as PrefGroup), showIf: { path: 'never' } } } };
    expect(prefScopeAt(hidden, 'glow.on', over({})).shown).toBe(false);
  });

  it('holds for a section, and for a leaf with fields', () => {
    const section: PrefSection = {
      name: 'Root',
      members: {
        look: { name: 'Look', enableIf: { path: 'lit' }, members: { lit: bool('Lit', { heading: true }), gain: num('Gain') } },
      },
    };
    const dark = over({ lit: false });
    expect([...applyPrefConditions(section, dark).disabled]).toEqual(['gain']);
    expect(prefScopeAt(section, 'lit', dark).enabled).toBe(true);

    const object: PrefGroup = {
      name: 'Root',
      children: {
        stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, enableIf: { path: 'stroke.on' }, children: { on: bool('On'), width: num('Width') } } as PrefLeaf,
      },
    };
    const bare = over({ stroke: { on: false } });
    expect([...applyPrefConditions(object, bare).disabled].sort()).toEqual(['stroke', 'stroke.width']);
    expect(prefScopeAt(object, 'stroke.on', bare).enabled).toBe(true);
  });
});
