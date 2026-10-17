import { cleanup, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefControl } from './PrefControl';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;

const phase = {
  kind: 'object', name: 'Phase', description: '', default: {},
  children: { length: num('Length'), ease: num('Ease', { showIf: { path: 'eased' } }), hold: num('Hold', { enableIf: { path: 'holds' } }) },
} as PrefLeaf;
const schema: PrefGroup = {
  name: '',
  children: {
    eased: flag('Eased'),
    holds: flag('Holds'),
    open: flag('Open'),
    phases: { kind: 'list', name: 'Phases', description: '', default: [], item: phase } as PrefLeaf,
    weights: { kind: 'map', name: 'Weights', description: '', default: {}, item: num('Weight', { enableIf: { path: 'open' } }) } as PrefLeaf,
    byName: { kind: 'map', name: 'By name', description: '', default: {}, item: phase } as PrefLeaf,
    tags: { kind: 'list', name: 'Tags', description: '', default: [], item: { kind: 'string', name: 'Tag', description: '', default: '', enableIf: { path: 'open' } } } as PrefLeaf,
  },
};
const held = { phases: [{ length: 1 }, { length: 2 }], weights: { left: 3 }, byName: { a: { length: 4 } }, tags: ['x'] };
const form = (flags: Record<string, boolean>) => <PrefsForm schema={schema} values={{ ...held, ...flags }} onChange={() => {}} />;

describe("PrefsForm conditions on a list's and a map's item", () => {
  it("hides a field of every entry while the item's showIf for it fails", () => {
    const { rerender } = renderWithIcons(form({ eased: false }));
    expect(screen.getAllByRole('spinbutton', { name: 'Length' })).toHaveLength(3);
    expect(screen.queryByRole('spinbutton', { name: 'Ease' })).toBeNull();
    rerender(form({ eased: true }));
    expect(screen.getAllByRole('spinbutton', { name: 'Ease' })).toHaveLength(3);
  });

  it("disables a field of every entry while the item's enableIf for it fails", () => {
    const { rerender } = renderWithIcons(form({ holds: false }));
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' })) expect(hold).toBeDisabled();
    expect(screen.getAllByRole('spinbutton', { name: 'Length' })[0]).toBeEnabled();
    rerender(form({ holds: true }));
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' })) expect(hold).toBeEnabled();
  });

  it("disables every entry's control while the item's own enableIf fails", () => {
    const { rerender } = renderWithIcons(form({ open: false }));
    expect(screen.getByRole('spinbutton', { name: 'Weight left' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Tag 1' })).toBeDisabled();
    rerender(form({ open: true }));
    expect(screen.getByRole('spinbutton', { name: 'Weight left' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Tag 1' })).toBeEnabled();
  });
});

describe('PrefControl', () => {
  it('disables the fields its owner says a condition disables, an entry of a list by the item', () => {
    const list = schema.children.phases as PrefLeaf;
    renderWithIcons(<PrefControl pref={list} path="phases" value={held.phases} onChange={() => {}} disabledAt={(at) => at === 'phases.*.hold'} />);
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' })) expect(hold).toBeDisabled();
    expect(screen.getAllByRole('spinbutton', { name: 'Length' })[0]).toBeEnabled();
  });
});
