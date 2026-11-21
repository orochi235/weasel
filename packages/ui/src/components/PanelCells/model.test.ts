import { describe, expect, it } from 'vitest';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { effectiveSections, panelRowsOf } from './model';

const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const paths = (schemas: Record<string, PrefSection>): string[] =>
  effectiveSections(Object.keys(schemas), Object.entries(schemas).map(([name, schema]) => ({ name, schema })))
    .flatMap(panelRowsOf).flatMap((row) => row.leaves.map((l) => l.path));

describe('effectiveSections across kinds', () => {
  it('shares a leaf whose kinds differ only in how it is drawn', () => {
    expect(paths({
      rect: { name: 'Rect', members: { 'data.w': num('Width', { max: 9, icon: 'a', pair: { with: 'data.h' } }), 'data.h': num('Height') } },
      star: { name: 'Star', members: { 'data.w': num('Size', { max: 9, description: 'Across' }), 'data.h': num('Tall') } },
    })).toEqual(['data.w', 'data.h']);
  });

  it('leaves out a leaf whose kinds read, bound, or reset it differently', () => {
    const rect: PrefSection = { name: 'Rect', members: {
      'data.radius': num('Radius', { max: 50, absentIsDefault: true }),
      'data.mode': { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }] } as PrefLeaf,
      'data.style': { kind: 'object', name: 'Style', description: '', default: {}, children: { size: num('Size', { max: 5 }) } } as PrefLeaf,
      'data.keep': num('Keep'),
    } };
    const star: PrefSection = { name: 'Star', members: {
      'data.radius': num('Radius', { max: 500, default: 20 }),
      'data.mode': { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } as PrefLeaf,
      'data.style': { kind: 'object', name: 'Style', description: '', default: {}, children: { size: num('Size', { max: 6 }) } } as PrefLeaf,
      'data.keep': num('Keep'),
    } };
    expect(paths({ rect, star })).toEqual(['data.keep']);
  });
});
