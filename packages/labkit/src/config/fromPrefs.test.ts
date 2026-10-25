import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { schemaNodeAtPath } from './path';
import { resolveConfigSchema } from './resolve';
import { isLeafEnabled, isLeafVisible } from './visible';

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
  it('nests each leaf at the path its key names, as the config holds it', () => {
    const config = f.prefs(SCHEMA);
    expect(config.defaults()).toEqual({
      data: { title: 'pose.x', stroke: { width: 1 } },
      pose: { x: 4, y: 0 },
    });
    const resolved = resolveConfigSchema(config, []);
    expect(schemaNodeAtPath(resolved.group, 'pose.x')).toMatchObject({
      kind: 'number',
      name: 'X',
      default: 4,
      pair: { with: 'pose.y' },
    });
    expect(schemaNodeAtPath(resolved.group, 'data.title')).toMatchObject({ kind: 'field' });
  });

  it('draws no heading for a segment of a path, which no group of the schema named', () => {
    const resolved = resolveConfigSchema(f.prefs(SCHEMA), []);
    expect((schemaNodeAtPath(resolved.group, 'pose') as PrefGroup).name).toBe('');
    expect((schemaNodeAtPath(resolved.group, 'data.stroke') as PrefGroup).name).toBe('');
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
        expect(isLeafVisible(resolved, path, config('a', true))).toBe(true);
        expect(isLeafVisible(resolved, path, config('b', true))).toBe(false);
      }
      expect(isLeafVisible(resolved, 'mode', config('b', true))).toBe(true);
    });

    it('disables every leaf in the section while its enableIf does not hold, and keeps the leaf its own condition', () => {
      for (const path of ['data.stroke.width', 'data.stroke.dash']) {
        expect(isLeafEnabled(resolved, path, config('a', true))).toBe(true);
        expect(isLeafEnabled(resolved, path, config('a', false))).toBe(false);
      }
      expect(schemaNodeAtPath(resolved.group, 'data.stroke.width')).toMatchObject({
        enableIf: { all: [{ path: 'data.stroke.on' }, { path: 'data.stroke.width', above: -1 }] },
      });
    });

    it('leaves the switch its enableIf reads live, so the section can be turned back on', () => {
      expect(isLeafEnabled(resolved, 'data.stroke.on', config('a', false))).toBe(true);
    });
  });
});
