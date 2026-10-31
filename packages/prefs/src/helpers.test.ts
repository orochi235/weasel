import { describe, expect, it } from 'vitest';
import { ANGLE_RADIANS } from '@weasel-js/quantity';
import {
  assignPrefValueAtPath,
  filterPrefSubtree,
  flattenPrefValues,
  prefDisplayBounds,
  prefLeaves,
  prefValueAtPath,
  VERSION_RECORD,
  visiblePrefSubtree,
} from './helpers';
import type { PrefGroup } from './groups';
import type { PrefNumber } from './schema';
import { prefUnit, type PrefNumberUnit } from './unit';

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

  it('matches an alias left unnamed on the name and description of the leaf it shows', () => {
    const schema: PrefGroup = {
      name: 'Preferences',
      children: {
        ...SCHEMA.children,
        quick: {
          name: 'Quick',
          children: {
            grid: { kind: 'alias', name: '', description: '', default: undefined, of: 'canvas.showGrid' },
            lost: { kind: 'alias', name: '', description: '', default: undefined, of: 'canvas.gone' },
          },
        },
      },
    };
    const quick = (query: string) => Object.keys((filterPrefSubtree(schema, query)?.children.quick as PrefGroup | undefined)?.children ?? {});
    expect(quick('show grid')).toEqual(['grid']);
    expect(quick('alignment')).toEqual(['grid']);
    expect(quick('author')).toEqual([]);

    const hidden = { ...schema, children: { quick: schema.children.quick! } };
    expect(filterPrefSubtree(hidden, 'alignment')).toBeNull();
    const kept = filterPrefSubtree(hidden, 'alignment', '', SCHEMA);
    expect(Object.keys((kept?.children.quick as PrefGroup).children)).toEqual(['grid']);
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

  it('matches a leaf on a tag, and keeps every leaf of a group a tag matches', () => {
    const schema: PrefGroup = {
      name: 'Preferences',
      children: {
        canvas: {
          name: 'Canvas',
          tags: ['workspace'],
          children: {
            grid: { kind: 'boolean', name: 'Show grid', description: '', default: true, tags: ['guides'] },
            ruler: { kind: 'boolean', name: 'Rulers', description: '', default: true },
          },
        },
        quick: {
          name: 'Quick',
          children: { grid: { kind: 'alias', name: 'Grid', description: '', default: undefined, of: 'canvas.grid' } },
        },
      },
    };
    const kept = (query: string) => {
      const out = filterPrefSubtree(schema, query);
      return Object.entries(out?.children ?? {}).flatMap(([k, g]) => Object.keys((g as PrefGroup).children).map((c) => `${k}.${c}`));
    };
    expect(kept('GUIDE')).toEqual(['canvas.grid', 'quick.grid']);
    expect(kept('workspace')).toEqual(['canvas.grid', 'canvas.ruler']);
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

  it('drops the hidden fields of an object leaf, and the sections they empty, keeping the leaf', () => {
    const shown = { kind: 'number', name: 'Width', description: '', default: 1 } as const;
    const hidden = { kind: 'number', name: 'Miter', description: '', default: 4, hidden: true } as const;
    const stroke = {
      kind: 'object', name: 'Stroke', description: '', default: {},
      children: { width: shown, miter: hidden, more: { name: 'More', members: { dash: hidden } } },
    } as const;
    const schema: PrefGroup = { name: 'Root', children: { stroke, bare: { ...stroke, children: { miter: hidden } } } };
    expect(visiblePrefSubtree(schema, false)).toEqual({
      name: 'Root',
      children: { stroke: { ...stroke, children: { width: shown } }, bare: { ...stroke, children: {} } },
    });
    expect(visiblePrefSubtree(schema, true)?.children.stroke).toBe(stroke);
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
    expect(prefDisplayBounds({ ...leaf, stops: [0, 4] }).stops).toEqual([100, 96]);
  });

  it('carries stops through unchanged without a unit', () => {
    const leaf: PrefNumber = { kind: 'number', name: 'S', description: '', default: 0, min: -1, max: 1, stops: [0] };
    expect(prefDisplayBounds(leaf)).toEqual({ min: -1, max: 1, step: 1, stops: [0] });
  });

  it('leaves an omitted bound omitted', () => {
    const leaf: PrefNumber = {
      kind: 'number', name: 'R', description: '', default: 0, unit: degrees,
    };
    expect(prefDisplayBounds(leaf)).toEqual({ min: undefined, max: undefined, step: 1 });
  });
});

const TREE_SCHEMA: PrefGroup = {
  name: 'Test',
  children: {
    a: { kind: 'number', name: 'A', description: '', default: 1 },
    g: {
      name: 'G',
      children: {
        b: { kind: 'boolean', name: 'B', description: '', default: false },
        o: {
          kind: 'object',
          name: 'O',
          description: '',
          default: {},
          children: { x: { kind: 'number', name: 'X', description: '', default: 0 } },
        },
      },
    },
  },
};

describe('prefLeaves', () => {
  it('maps each leaf path to its leaf, stopping at object leaves', () => {
    expect([...prefLeaves(TREE_SCHEMA).keys()]).toEqual(['a', 'g.b', 'g.o']);
  });

  it('rejects a key containing a dot', () => {
    const leaf = { kind: 'boolean', name: 'L', description: '', default: true } as const;
    expect(() => prefLeaves({ name: 'T', children: { 'a.b': leaf } })).toThrow(
      '[prefs] schema key "a.b" contains "."; group keys are path segments',
    );
  });

  it('rejects a top-level key named like the version record', () => {
    const leaf = { kind: 'boolean', name: 'L', description: '', default: true } as const;
    expect(() => prefLeaves({ name: 'T', children: { [VERSION_RECORD]: leaf } })).toThrow(
      '[prefs] schema key "$version" is reserved',
    );
    expect(() =>
      prefLeaves({ name: 'T', children: { g: { name: 'G', children: { [VERSION_RECORD]: leaf } } } }),
    ).not.toThrow();
  });
});

describe('flattenPrefValues', () => {
  it('lists each leaf present in the tree as a path and value, skipping absent ones', () => {
    expect(flattenPrefValues(TREE_SCHEMA, { a: 2, g: { o: { x: 3 } }, stray: 9 })).toEqual([
      ['a', 2],
      ['g.o', { x: 3 }],
    ]);
  });
});

describe('paths through names every object inherits', () => {
  it('reads nothing a tree does not hold itself', () => {
    expect(prefValueAtPath({}, 'toString')).toBeUndefined();
    expect(prefValueAtPath({ a: {} }, 'a.constructor.name')).toBeUndefined();
    const leaf = { kind: 'boolean', name: 'On', description: '', default: true } as const;
    const schema: PrefGroup = { name: 'T', children: { constructor: leaf, valueOf: leaf } };
    expect(flattenPrefValues(schema, { valueOf: false })).toEqual([['valueOf', false]]);
  });

  it('assigns into the tree and nowhere else', () => {
    const tree: Record<string, unknown> = {};
    assignPrefValueAtPath(tree, 'constructor.probe', 1);
    assignPrefValueAtPath(tree, '__proto__.probe', 2);
    expect((Object as unknown as Record<string, unknown>).probe).toBeUndefined();
    expect(({} as Record<string, unknown>).probe).toBeUndefined();
    expect(Object.getPrototypeOf(tree)).toBe(Object.prototype);
    expect(prefValueAtPath(tree, 'constructor.probe')).toBe(1);
    expect(prefValueAtPath(tree, '__proto__.probe')).toBe(2);
  });
});
