import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { autoQuotes } from './autoConfig';
import { f } from './builder';
import { schemaNodeAt } from './path';
import { resolveConfigSchema } from './resolve';
import { prefsFromConfig } from './toPrefs';
import { isRowEnabled, isRowVisible } from './visible';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;

const SCHEMA: PrefSection = {
  name: 'Box',
  members: {
    'data.title': { kind: 'field', name: 'Title', description: '', default: 'pose.x' } as PrefLeaf,
    layout: {
      name: 'Layout',
      members: {
        'pose.x': num('X', { default: 4, pair: { with: 'pose.y', label: 'Position' } }),
        'pose.y': num('Y'),
      },
    },
    look: {
      name: '',
      members: { 'data.stroke.width': num('Width', { default: 1 }) },
    },
  },
};

describe('f.prefs', () => {
  it('keeps the auto a leaf says, and gives one that says none no `auto`', () => {
    const config = f.prefs({
      name: 'Box',
      members: { a: num('A', { auto: { on: true } }), b: num('B') },
    });
    const resolved = resolveConfigSchema(config, []);
    const leaf = (path: string) => schemaNodeAt(resolved.group, path) as PrefLeaf;
    expect(leaf('a').auto).toEqual({ on: true });
    expect('auto' in leaf('b')).toBe(false);
  });

  it("keeps a leaf's .quote() through a round trip to a prefs schema", () => {
    const once = resolveConfigSchema(f.schema({ count: f.number(3).quote() }), []);
    const back = resolveConfigSchema(f.prefs(prefsFromConfig(once)), []);
    expect(autoQuotes(schemaNodeAt(back.group, 'count') as PrefLeaf)).toBe(true);
  });

  it("keeps an f.custom leaf's validate through a round trip to a prefs schema", () => {
    const validate = () => ['two numbers'];
    const once = resolveConfigSchema(f.schema({ vec: f.custom('vec', [0, 0], validate) }), []);
    const back = f.prefs(prefsFromConfig(once));
    expect((back.nodes.vec as { options: { validate?: unknown } }).options.validate).toBe(validate);
    expect(resolveConfigSchema(back, []).validators?.get('vec')).toBe(validate);
  });

  it('keeps the selectors a schema admits through a round trip to a prefs schema', () => {
    const once = resolveConfigSchema(f.schema({ n: f.number(1) }).admits('doc'), []);
    const back = f.prefs(prefsFromConfig(once));
    expect(back.admitted).toEqual(['doc']);
    expect(resolveConfigSchema(back, []).group.admits).toEqual(['doc']);
  });

  it('nests each leaf at the path its key names, as the config holds it', () => {
    const config = f.prefs(SCHEMA);
    expect(config.defaults()).toEqual({
      data: { title: 'pose.x', stroke: { width: 1 } },
      pose: { x: 4, y: 0 },
    });
    const resolved = resolveConfigSchema(config, []);
    expect(schemaNodeAt(resolved.group, 'pose.x')).toMatchObject({
      kind: 'number',
      name: 'X',
      default: 4,
      pair: { with: 'pose.y' },
    });
    expect(schemaNodeAt(resolved.group, 'data.title')).toMatchObject({ kind: 'field' });
  });

  it('draws no heading for a segment of a path, which no group of the schema named', () => {
    const resolved = resolveConfigSchema(f.prefs(SCHEMA), []);
    expect((schemaNodeAt(resolved.group, 'pose') as PrefGroup).name).toBe('');
    expect((schemaNodeAt(resolved.group, 'data.stroke') as PrefGroup).name).toBe('');
  });

  it('keeps a named section as a heading over its leaves, and an unnamed one as none', () => {
    const resolved = resolveConfigSchema(f.prefs(SCHEMA), []);
    expect(resolved.sections).toEqual([
      { at: 'pose', label: 'Layout', paths: ['pose.x', 'pose.y'] },
    ]);
  });

  it('leaves an encoded leaf out of the defaults, whose default is the option it reads as and not a stored value', () => {
    const skew = {
      kind: 'boolean',
      name: 'Skew',
      description: '',
      default: false,
      encoding: {
        read: (v: unknown) => v !== undefined,
        write: (on: boolean) => (on ? [1, 0] : undefined),
      },
    } as unknown as PrefLeaf;
    expect(
      f.prefs({ name: '', members: { 'pose.skew': skew, 'pose.x': num('X') } }).defaults(),
    ).toEqual({ pose: { x: 0 } });
  });

  it('takes a leaf at the root of the schema as it is', () => {
    const config = f.prefs({ name: '', members: { gap: num('Gap', { default: 2 }) } });
    expect(config.defaults()).toEqual({ gap: 2 });
    expect(resolveConfigSchema(config, []).group.children.gap).toMatchObject({
      kind: 'number',
      name: 'Gap',
    });
  });

  describe("a section's conditions", () => {
    const GATED: PrefSection = {
      name: '',
      members: {
        mode: {
          kind: 'enum',
          name: 'Mode',
          description: '',
          default: 'a',
          options: ['a', 'b'],
        } as PrefLeaf,
        stroke: {
          name: 'Stroke',
          showIf: { path: 'mode', is: 'a' },
          enableIf: { path: 'data.stroke.on' },
          members: {
            'data.stroke.on': {
              kind: 'boolean',
              name: 'On',
              description: '',
              default: false,
            } as PrefLeaf,
            'data.stroke.width': num('Width', {
              enableIf: { path: 'data.stroke.width', above: -1 },
            }),
            more: {
              name: 'More',
              members: { 'data.stroke.dash': num('Dash') },
            },
          },
        },
      },
    };
    const resolved = resolveConfigSchema(f.prefs(GATED), []);
    const config = (mode: string, on: boolean) => ({
      mode,
      data: { stroke: { on, width: 1, dash: 0 } },
    });

    it('hides every leaf in the section while its showIf does not hold', () => {
      for (const path of ['data.stroke.on', 'data.stroke.width', 'data.stroke.dash']) {
        expect(isRowVisible(resolved, path, config('a', true))).toBe(true);
        expect(isRowVisible(resolved, path, config('b', true))).toBe(false);
      }
      expect(isRowVisible(resolved, 'mode', config('b', true))).toBe(true);
    });

    it('disables every leaf in the section while its enableIf does not hold, and keeps the leaf its own condition', () => {
      for (const path of ['data.stroke.width', 'data.stroke.dash']) {
        expect(isRowEnabled(resolved, path, config('a', true))).toBe(true);
        expect(isRowEnabled(resolved, path, config('a', false))).toBe(false);
      }
      expect(schemaNodeAt(resolved.group, 'data.stroke.width')).toMatchObject({
        enableIf: { all: [{ path: 'data.stroke.on' }, { path: 'data.stroke.width', above: -1 }] },
      });
    });

    it('leaves the switch its enableIf reads live, so the section can be turned back on', () => {
      expect(isRowEnabled(resolved, 'data.stroke.on', config('a', false))).toBe(true);
    });
  });
  it("leaves a section's switch live inside a group's object leaf, where its key is relative", () => {
    const grid: PrefSection = {
      name: '',
      members: {
        grid: {
          kind: 'object',
          name: 'Grid',
          description: '',
          default: { on: false, size: 8 },
          group: {},
          children: {
            lines: {
              name: 'Lines',
              enableIf: { path: 'grid.on', is: true },
              members: {
                on: { kind: 'boolean', name: 'On', description: '', default: false } as PrefLeaf,
                size: num('Size', { default: 8 }),
              },
            },
          },
        } as unknown as PrefLeaf,
      },
    };
    const resolved = resolveConfigSchema(f.prefs(grid), []);
    const off = { grid: { on: false, size: 8 } };
    expect(isRowEnabled(resolved, 'grid.on', off)).toBe(true);
    expect(isRowEnabled(resolved, 'grid.size', off)).toBe(false);
  });
  describe('a dotted key and a member at its prefix', () => {
    const group = (children: Record<string, PrefLeaf>): PrefLeaf =>
      ({
        kind: 'object',
        name: 'Grid',
        description: '',
        default: {},
        group: {},
        children: { inner: { name: '', members: children } },
      }) as unknown as PrefLeaf;
    const rows = (members: PrefSection['members']) => {
      const schema = f.prefs({ name: '', members });
      const shape = schema.nodes as Record<string, { children?: Record<string, unknown> }>;
      return Object.keys(shape.grid?.children ?? {}).sort();
    };

    it('places a group after a dotted key under it without dropping that key', () => {
      expect(rows({ 'grid.extra': num('Extra'), grid: group({ size: num('Size') }) })).toEqual([
        'extra',
        'size',
      ]);
    });

    it('places a group before a dotted key under it the same way', () => {
      expect(rows({ grid: group({ size: num('Size') }), 'grid.extra': num('Extra') })).toEqual([
        'extra',
        'size',
      ]);
    });

    it('throws where a leaf and a branch both claim the path', () => {
      expect(() => f.prefs({ name: '', members: { grid: num('G'), 'grid.size': num('S') } })).toThrow(
        /grid/,
      );
      expect(() => f.prefs({ name: '', members: { 'grid.size': num('S'), grid: num('G') } })).toThrow(
        /grid/,
      );
    });
  });
});
