import { describe, it, expect } from 'vitest';
import type { NodePropertiesEntry, NodeRoutingEntry } from '@weasel-js/core';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
} from './model';

const routing: NodeRoutingEntry[] = [
  { name: 'rect', matches: (d) => (d as { kind?: string })?.kind === 'rect' },
  { name: 'text', matches: (d) => (d as { kind?: string })?.kind === 'text' },
];

const num = (name: string, pair?: string) =>
  ({ kind: 'number', name, description: name, default: 0, ...(pair ? { pair } : {}) }) as const;

const entries: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      children: {
        layout: {
          name: 'Layout',
          children: {
            'pose.x': num('X', 'Position'),
            'pose.y': num('Y', 'Position'),
            'pose.width': num('W', 'Size'),
          },
        },
        appearance: {
          name: 'Appearance',
          children: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000' },
            'data.corner': num('Corner radius'),
          },
        },
      },
    },
  },
  {
    name: 'text',
    schema: {
      name: 'Properties',
      children: {
        layout: {
          name: 'Layout',
          children: { 'pose.x': num('X', 'Position'), 'pose.y': num('Y', 'Position') },
        },
        appearance: {
          name: 'Appearance',
          children: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000' },
            // deliberately different leaf kind at a shared path:
            'data.corner': { kind: 'string', name: 'Corner', description: 'c', default: '' },
          },
        },
      },
    },
  },
];

const leaf = (id: string, data: unknown, pose = { x: 0, y: 0 }) =>
  ({ id, kind: 'leaf', layer: 'default', pose, data, parent: null }) as never;

describe('classifyKind', () => {
  it('classifies containers as group and data by routing match', () => {
    expect(classifyKind(leaf('a', { kind: 'rect' }), routing)).toBe('rect');
    expect(classifyKind({ ...(leaf('c', {}) as object), kind: 'container' } as never, routing)).toBe('group');
    expect(classifyKind(leaf('u', { kind: 'blob' }), routing)).toBe('unknown');
  });
});

describe('effectiveSections', () => {
  it('returns the full schema for a single kind, with pair rows merged', () => {
    const sections = effectiveSections(['rect'], entries);
    expect(sections.map((s) => s.name)).toEqual(['Layout', 'Appearance']);
    const layout = sections[0];
    expect(layout.rows.map((r) => r.label)).toEqual(['Position', 'Size']);
    expect(layout.rows[0].leaves.map((l) => l.path)).toEqual(['pose.x', 'pose.y']);
  });

  it('intersects across kinds by (path, leaf kind)', () => {
    const sections = effectiveSections(['rect', 'text'], entries);
    const paths = sections.flatMap((s) => s.rows.flatMap((r) => r.leaves.map((l) => l.path)));
    expect(paths).toContain('pose.x');
    expect(paths).toContain('data.fill');
    expect(paths).not.toContain('pose.width');   // absent from text
    expect(paths).not.toContain('data.corner');  // kind conflict number vs string
  });

  it('a kind with no registered schema collapses the intersection', () => {
    expect(effectiveSections(['rect', 'unknown'], entries)).toEqual([]);
  });

  it('duplicate kinds count once', () => {
    expect(effectiveSections(['rect', 'rect'], entries)).toEqual(effectiveSections(['rect'], entries));
  });
});

describe('aggregateValue', () => {
  it('returns the shared value, MIXED on divergence, and reads pose/data roots', () => {
    const a = leaf('a', { kind: 'rect', fill: '#f00' }, { x: 5, y: 1 });
    const b = leaf('b', { kind: 'rect', fill: '#f00' }, { x: 9, y: 1 });
    expect(aggregateValue([a, b], 'data.fill')).toBe('#f00');
    expect(aggregateValue([a, b], 'pose.x')).toBe(MIXED);
    expect(aggregateValue([a, b], 'pose.y')).toBe(1);
  });

  it('treats missing values as a divergence when only some nodes have them', () => {
    const a = leaf('a', { kind: 'rect', fill: '#f00' });
    const b = leaf('b', { kind: 'rect' });
    expect(aggregateValue([a, b], 'data.fill')).toBe(MIXED);
    expect(aggregateValue([b], 'data.fill')).toBeUndefined();
  });
});

describe('kindBreakdown', () => {
  it('formats counts newest-order-preserving', () => {
    expect(kindBreakdown(['rect', 'text', 'rect'])).toBe('rect ×2 · text');
  });
});
