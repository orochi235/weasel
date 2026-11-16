import { describe, it, expect } from 'vitest';
import { createNodeProperties, type NodePropertiesEntry } from './NodeProperties';

const entry = (name: string): NodePropertiesEntry => ({
  name,
  schema: {
    name: 'Properties',
    members: {
      layout: {
        name: 'Layout',
        members: {
          'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0 },
        },
      },
    },
  },
});

describe('createNodeProperties', () => {
  it('registers, looks up, and lists in registration order', () => {
    const reg = createNodeProperties();
    reg.register(entry('rect'));
    reg.register(entry('text'));
    expect(reg.get('rect')?.name).toBe('rect');
    expect(reg.get('nope')).toBeUndefined();
    expect(reg.list().map((e) => e.name)).toEqual(['rect', 'text']);
  });

  it('throws on duplicate kind names', () => {
    const reg = createNodeProperties();
    reg.register(entry('rect'));
    expect(() => reg.register(entry('rect'))).toThrow(/duplicate/);
  });

  it('reflects the kinds by name, the first registration standing', () => {
    const reg = createNodeProperties();
    const rect = entry('rect');
    reg.register(rect);
    expect(() => reg.register(entry('rect'))).toThrow(/duplicate/);
    expect(reg.reflection.entries().map((e) => [e.key, e.value, e.shadowed.length])).toEqual([['rect', rect, 0]]);
  });
});
