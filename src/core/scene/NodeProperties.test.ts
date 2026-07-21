import { describe, it, expect } from 'vitest';
import { createNodeProperties, type NodePropertiesEntry } from './NodeProperties';

const entry = (name: string): NodePropertiesEntry => ({
  name,
  schema: {
    name: 'Properties',
    children: {
      layout: {
        name: 'Layout',
        children: {
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
});
