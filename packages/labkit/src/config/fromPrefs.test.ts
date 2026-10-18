import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { schemaNodeAtPath } from './path';
import { resolveConfigSchema } from './resolve';

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
    expect(config.defaults()).toEqual({ data: { title: 'pose.x', stroke: { width: 1 } }, pose: { x: 4, y: 0 } });
    const resolved = resolveConfigSchema(config, []);
    expect(schemaNodeAtPath(resolved.group, 'pose.x')).toMatchObject({ kind: 'number', name: 'X', default: 4, pair: { with: 'pose.y' } });
    expect(schemaNodeAtPath(resolved.group, 'data.title')).toMatchObject({ kind: 'field' });
  });

  it('draws no heading for a segment of a path, which no group of the schema named', () => {
    const resolved = resolveConfigSchema(f.prefs(SCHEMA), []);
    expect((schemaNodeAtPath(resolved.group, 'pose') as PrefGroup).name).toBe('');
    expect((schemaNodeAtPath(resolved.group, 'data.stroke') as PrefGroup).name).toBe('');
  });

  it('keeps a named section as a heading over its leaves, and an unnamed one as none', () => {
    const resolved = resolveConfigSchema(f.prefs(SCHEMA), []);
    expect(resolved.sections).toEqual([{ at: 'pose', label: 'Layout', paths: ['pose.x', 'pose.y'] }]);
  });

  it('leaves an encoded leaf out of the defaults, whose default is the option it reads as and not a stored value', () => {
    const skew = {
      kind: 'boolean', name: 'Skew', description: '', default: false,
      encoding: { read: (v: unknown) => v !== undefined, write: (on: boolean) => (on ? [1, 0] : undefined) },
    } as unknown as PrefLeaf;
    expect(f.prefs({ name: '', members: { 'pose.skew': skew, 'pose.x': num('X') } }).defaults()).toEqual({ pose: { x: 0 } });
  });

  it('takes a leaf at the root of the schema as it is', () => {
    const config = f.prefs({ name: '', members: { gap: num('Gap', { default: 2 }) } });
    expect(config.defaults()).toEqual({ gap: 2 });
    expect(resolveConfigSchema(config, []).group.children.gap).toMatchObject({ kind: 'number', name: 'Gap' });
  });
});
