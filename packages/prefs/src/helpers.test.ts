import { describe, expect, it } from 'vitest';
import { ANGLE_RADIANS } from '@weasel-js/quantity';
import { filterPrefSubtree, prefDisplayBounds, visiblePrefSubtree } from './helpers';
import { prefUnit, type PrefGroup, type PrefNumber, type PrefNumberUnit } from './schema';

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: 'Alignment grid.', default: true },
        snapping: {
          name: 'Snapping',
          children: {
            enabled: { kind: 'boolean', name: 'Enabled', description: 'Master toggle.', default: true },
            wrap: {
              name: 'Wrapping',
              children: {
                atEdge: { kind: 'boolean', name: 'Wrap at edge', description: 'Continue from the far side.', default: false },
              },
            },
          },
        },
      },
    },
    io: {
      name: 'Import / Export',
      children: {
        author: { kind: 'string', name: 'Author', description: 'Embedded in exports.', default: '' },
      },
    },
  },
};

const degrees = prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' });

describe('filterPrefSubtree', () => {
  it('keeps only matching leaves and prunes the groups left empty', () => {
    const filtered = filterPrefSubtree(SCHEMA, 'author');
    expect(Object.keys(filtered?.children ?? {})).toEqual(['io']);
  });

  it('matches a leaf on its description as well as its name', () => {
    const filtered = filterPrefSubtree(SCHEMA, 'alignment');
    const canvas = filtered?.children.canvas as PrefGroup;
    expect(Object.keys(canvas.children)).toEqual(['showGrid']);
  });

  it('keeps every leaf of a group whose own name matches', () => {
    const filtered = filterPrefSubtree(SCHEMA, 'snapping');
    const canvas = filtered?.children.canvas as PrefGroup;
    expect(Object.keys(canvas.children)).toEqual(['snapping']);
    expect(Object.keys((canvas.children.snapping as PrefGroup).children)).toEqual([
      'enabled',
      'wrap',
    ]);
  });

  it('returns the tree unchanged for an empty or blank query', () => {
    expect(filterPrefSubtree(SCHEMA, '')).toBe(SCHEMA);
    expect(filterPrefSubtree(SCHEMA, '   ')).toBe(SCHEMA);
  });

  it('is null when nothing matches', () => {
    expect(filterPrefSubtree(SCHEMA, 'zzz')).toBeNull();
  });
});

describe('visiblePrefSubtree', () => {
  it('prunes groups whose leaves are all hidden', () => {
    const schema: PrefGroup = {
      name: 'Root',
      children: {
        ghost: {
          name: 'Ghost',
          children: {
            a: { kind: 'boolean', name: 'A', description: '', default: false, hidden: true },
          },
        },
      },
    };
    expect(visiblePrefSubtree(schema, false)).toBeNull();
    expect(visiblePrefSubtree(schema, true)).not.toBeNull();
  });
});

describe('prefDisplayBounds', () => {
  it('passes a unitless leaf\'s bounds through, defaulting only the step', () => {
    const leaf: PrefNumber = { kind: 'number', name: 'W', description: '', default: 0, min: 2, max: 8 };
    expect(prefDisplayBounds(leaf)).toEqual({ min: 2, max: 8, step: 1 });
  });

  it('converts min and max as points and step as a distance', () => {
    const leaf: PrefNumber = {
      kind: 'number', name: 'R', description: '', default: 0,
      min: 0, max: Math.PI, step: Math.PI / 180, unit: degrees,
    };
    const b = prefDisplayBounds(leaf);
    expect(b.min).toBe(0);
    expect(b.max).toBe(180);
    expect(b.step).toBe(1);
  });

  // An offset unit is why `step` converts as a distance rather than a point:
  // read as a point it would come back as 98 rather than 2.
  it('swaps the ends when the conversion decreases, and keeps step a distance', () => {
    const remaining: PrefNumberUnit = {
      toDisplay: (v) => 100 - v,
      fromDisplay: (v) => 100 - v,
    };
    const leaf: PrefNumber = {
      kind: 'number', name: 'D', description: '', default: 0,
      min: 0, max: 10, step: 2, unit: remaining,
    };
    expect(prefDisplayBounds(leaf)).toEqual({ min: 90, max: 100, step: 2 });
  });

  it('leaves an omitted bound omitted', () => {
    const leaf: PrefNumber = {
      kind: 'number', name: 'R', description: '', default: 0, unit: degrees,
    };
    expect(prefDisplayBounds(leaf)).toEqual({ min: undefined, max: undefined, step: 1 });
  });
});
