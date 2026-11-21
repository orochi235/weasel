import { describe, expect, it } from 'vitest';
import { type PrefLeaf, type PrefSection } from '@weasel-js/prefs';
import { effectiveSections } from './model';
import { panelMarkedPaths } from './selection';

const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'toggle', ...extra }) as PrefLeaf;
const object = (name: string, children: Record<string, unknown>): PrefLeaf =>
  ({ kind: 'object', name, description: '', default: {}, block: true, children }) as PrefLeaf;

const marked = (schema: PrefSection, selected: string[]): string[] =>
  panelMarkedPaths(effectiveSections(['k'], [{ name: 'k', schema }]), selected);

describe("panelMarkedPaths over an object leaf's fields", () => {
  it('marks a field its own row where a section between it and the field naming it in a pair parts them', () => {
    const schema: PrefSection = { name: 'K', members: {
      'data.o': object('O', { a: num('A', { pair: { with: 'data.o.b' } }), sec: { name: 'Sec', members: { b: num('B') } } }),
    } };
    expect(marked(schema, ['data.o.b'])).toEqual(['data.o.b']);
  });

  it('still marks a pair of neighboring fields as the row of its first', () => {
    const schema: PrefSection = { name: 'K', members: { 'data.o': object('O', { a: num('A', { pair: { with: 'data.o.b' } }), b: num('B') }) } };
    expect(marked(schema, ['data.o.b'])).toEqual(['data.o.a']);
  });

  it('marks each cell of a bar under its own path, but a run of paired flags as its first', () => {
    const schema: PrefSection = { name: 'K', members: {
      'data.o': object('O', { tools: { name: 'Tools', as: 'bar', members: {
        n: num('N', { pair: { with: ['data.o.t', 'data.o.u'] } }), t: flag('T'), u: flag('U'),
      } } }),
    } };
    expect(marked(schema, ['data.o.n'])).toEqual(['data.o.n']);
    expect(marked(schema, ['data.o.t'])).toEqual(['data.o.t']);
    expect(marked(schema, ['data.o.u'])).toEqual(['data.o.t']);
  });
});
