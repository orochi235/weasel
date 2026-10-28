import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { aggregateAttributes } from './attrAggregate';
import { attributeSchema } from './kindSchemas';

const num = (over: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name: 'N', description: 'd', default: 1, min: 0, ...over }) as PrefLeaf;
const bool: PrefLeaf = { kind: 'boolean', name: 'B', description: 'd', default: false };
const group: PrefGroup = { name: 'G', children: {} };

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

  const frame = (name: string, description: string) => ({ kind: 'string', name, description, default: '' }) as PrefLeaf;
  const KINDS = {
    boxed: {
      frame: { kind: 'object', name: 'Frame', description: '', default: {}, children: { edge: frame('Edge', ''), fill: frame('Fill', ''), tags: { kind: 'list', name: 'Tags', description: '', default: [], item: frame('', '') } } } as PrefLeaf,
    },
  };
  const boxed = (held: Record<string, unknown>): PrefLeaf => ({ kind: 'boxed', name: 'B', description: '', default: '', frame: held }) as PrefLeaf;

  it('keeps an object attribute whose values disagree, with the fields that agree and a mark on each that does not', () => {
    const both = aggregateAttributes([boxed({ edge: 'thin', fill: 'red' }), boxed({ edge: 'thick', fill: 'red' })], KINDS);
    expect(both.schema.own).toHaveProperty('frame');
    expect(both.values.frame).toEqual({ fill: 'red' });
    expect([...both.mixed]).toEqual(['frame.edge']);
    expect(both.apart).toEqual([]);
  });

  it('still sets an object attribute apart when a field that disagrees has no mixed state', () => {
    const both = aggregateAttributes([boxed({ tags: ['a'] }), boxed({ tags: ['b'] })], KINDS);
    expect(both.schema.own).not.toHaveProperty('frame');
    expect(both.apart).toEqual(['frame']);
  });
});
