import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefLeaves, prefSectionLeaves } from './helpers';
import type { PrefObject } from './schema';

const x = { kind: 'number', name: 'X', description: '', default: 0 } as const;
const fill = { kind: 'color', name: 'Fill', description: '', default: '#000000' } as const;

const NESTED = { name: 'Prefs', children: { view: { name: 'View', children: { x } } } } satisfies PrefGroup;
const HEADED = {
  name: 'Properties',
  members: { layout: { name: 'Layout', members: { 'pose.x': x } }, 'data.fill': fill },
} satisfies PrefSection;

describe('PrefGroup and PrefSection', () => {
  it('tells the three node shapes apart', () => {
    expect([isPrefLeaf(x), isPrefSection(x)]).toEqual([true, false]);
    expect([isPrefLeaf(NESTED), isPrefSection(NESTED)]).toEqual([false, false]);
    expect([isPrefLeaf(HEADED), isPrefSection(HEADED)]).toEqual([false, true]);
  });

  it('reads a group key as a path segment and a section key as nothing', () => {
    expect([...prefLeaves(NESTED).keys()]).toEqual(['view.x']);
    expect(prefSectionLeaves(HEADED.members).map(([key]) => key)).toEqual(['pose.x', 'data.fill']);
  });

  it('walks the sections inside an object leaf by the same rule', () => {
    const style: PrefObject = {
      kind: 'object',
      name: 'Style',
      description: '',
      default: {},
      children: { character: { name: 'Character', members: { size: x } }, color: fill },
    };
    expect(prefSectionLeaves(style.children).map(([key]) => key)).toEqual(['size', 'color']);
  });

  it('rejects a schema of one kind where the other is required', () => {
    const takesGroup = (schema: PrefGroup): PrefGroup => schema;
    const takesSection = (schema: PrefSection): PrefSection => schema;
    takesGroup(NESTED);
    takesSection(HEADED);
    // @ts-expect-error a section's keys are not path segments
    takesGroup(HEADED);
    // @ts-expect-error a group's keys are path segments
    takesSection(NESTED);
    // @ts-expect-error a group does not nest a section
    takesGroup({ name: 'Prefs', children: { layout: HEADED.members.layout } });
    // @ts-expect-error a section does not nest a group
    takesSection({ name: 'Properties', members: { view: NESTED.children.view } });
    const style: PrefObject = {
      kind: 'object',
      name: 'Style',
      description: '',
      default: {},
      // @ts-expect-error a heading inside an object leaf is a section
      children: { view: NESTED.children.view },
    };
    expect(style.kind).toBe('object');
  });
});
