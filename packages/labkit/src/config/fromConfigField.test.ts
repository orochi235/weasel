import { describe, expect, it } from 'vitest';
import type { ConfigField } from '../controls/types';
import { fromConfigFields } from './fromConfigField';
import { isLeafVisible } from './visible';

const leaf = (fields: ConfigField[], k: string) =>
  fromConfigFields(fields).group.children[k] as unknown as Record<string, unknown>;

describe('fromConfigFields', () => {
  it('maps every ConfigField type to its PrefLeaf kind', () => {
    expect(
      leaf([{ type: 'slider', key: 'a', label: 'A', default: 1, min: 0, max: 2 }], 'a'),
    ).toMatchObject({
      kind: 'number',
      control: 'slider',
      min: 0,
      max: 2,
      default: 1,
      name: 'A',
    });
    expect(leaf([{ type: 'number', key: 'b', label: 'B', default: 1 }], 'b')).toMatchObject({
      kind: 'number',
      control: 'input',
    });
    expect(leaf([{ type: 'checkbox', key: 'c', label: 'C', default: true }], 'c')).toMatchObject({
      kind: 'boolean',
      control: 'checkbox',
    });
    expect(
      leaf(
        [
          {
            type: 'select',
            key: 'd',
            label: 'D',
            default: 'x',
            options: [{ value: 'x', label: 'X' }],
          },
        ],
        'd',
      ),
    ).toMatchObject({ kind: 'enum', options: [{ value: 'x', label: 'X' }] });
    expect(leaf([{ type: 'text', key: 'e', label: 'E', default: '' }], 'e')).toMatchObject({
      kind: 'string',
    });
    expect(leaf([{ type: 'color', key: 'g', label: 'G', default: '#fff' }], 'g')).toMatchObject({
      kind: 'color',
    });
  });

  it('gives every leaf the description PrefBase requires', () => {
    expect(leaf([{ type: 'checkbox', key: 'c', label: 'C', default: true }], 'c').description).toBe(
      '',
    );
  });

  it('carries the text debounce through as a labkit extra', () => {
    expect(
      leaf([{ type: 'text', key: 'e', label: 'E', default: '', debounceMs: 0 }], 'e').debounceMs,
    ).toBe(0);
  });

  it('drops absent optional annotations rather than settling them undefined', () => {
    expect('min' in leaf([{ type: 'number', key: 'b', label: 'B', default: 1 }], 'b')).toBe(false);
  });

  it('carries an unrecognized type through as its kind', () => {
    const odd = { type: 'vector2', key: 'v', label: 'V', default: 0 } as unknown as ConfigField;
    expect(leaf([odd], 'v').kind).toBe('vector2');
  });

  it('preserves declaration order', () => {
    const r = fromConfigFields([
      { type: 'checkbox', key: 'z', label: 'Z', default: true },
      { type: 'checkbox', key: 'a', label: 'A', default: true },
    ]);
    expect(Object.keys(r.group.children)).toEqual(['z', 'a']);
  });
});

describe('isLeafVisible', () => {
  it('is true for a leaf with no predicate', () => {
    const r = fromConfigFields([{ type: 'checkbox', key: 'a', label: 'A', default: true }]);
    expect(isLeafVisible(r, 'a', {})).toBe(true);
  });

  it('honors a hidden leaf unless asked to show hidden', () => {
    const r = fromConfigFields([{ type: 'checkbox', key: 'a', label: 'A', default: true }]);
    (r.group.children.a as unknown as Record<string, unknown>).hidden = true;
    expect(isLeafVisible(r, 'a', {})).toBe(false);
    expect(isLeafVisible(r, 'a', {}, true)).toBe(true);
  });
});
