import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { aggregateAttributes, sameValue } from './attrAggregate';
import { attributeSchema } from './kindSchemas';

const num = (over: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name: 'N', description: 'd', default: 1, min: 0, ...over }) as PrefLeaf;
const bool: PrefLeaf = { kind: 'boolean', name: 'B', description: 'd', default: false };
const group: PrefGroup = { name: 'G', children: {} };

describe('sameValue', () => {
  it('compares structure, not identity', () => {
    expect(sameValue([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });
});

describe('aggregateAttributes', () => {
  it('is the node\'s own schema for one node', () => {
    const one = aggregateAttributes([num()]);
    expect(one.schema).toEqual(attributeSchema(num()));
    expect(one.mixed.size).toBe(0);
    expect(one.kind).toBe('number');
  });

  it('keeps an attribute the nodes agree on, and marks one they do not', () => {
    const both = aggregateAttributes([num(), num({ name: 'Other', min: 5 })]);
    expect(both.values.description).toBe('d');
    expect(both.mixed.has('name')).toBe(true);
    expect(both.mixed.has('min')).toBe(true);
    expect(both.mixed.has('description')).toBe(false);
    expect('name' in both.values).toBe(false);
  });

  it('keeps only the attributes every kind has when the kinds differ', () => {
    const both = aggregateAttributes([num(), bool]);
    expect(Object.keys(both.schema.shared)).toContain('name');
    expect(both.schema.own).not.toHaveProperty('min');
    expect(both.kind).toBeNull();
  });

  it('says there is no kind when a group is among them', () => {
    const both = aggregateAttributes([num(), group]);
    expect(both.kind).toBeUndefined();
    expect(Object.keys(both.schema.shared)).toContain('name');
    expect(both.schema.own).toEqual({});
  });
});
