import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { PrefGroup, PrefList } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { PrefControl } from './PrefControl';
import { prefListEntry } from './ListLeaf';
import { renderWithIcons } from '../../testing/withIcons';

const schema: PrefGroup = {
  name: '',
  children: {
    gap: { kind: 'number', name: 'Gap', description: '', default: 4 },
    inset: { kind: 'number', name: 'Inset', description: '', default: 2, clearable: true },
  },
};

describe('what a form row shows for a value it does not hold', () => {
  it('shows the default for a value held as null', () => {
    renderWithIcons(<PrefsForm schema={schema} values={{ gap: null, inset: 1 }} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'Gap' })).toHaveValue('4');
  });

  it('shows a clearable number holding nothing as cleared, not at its default', () => {
    renderWithIcons(<PrefsForm schema={schema} values={{ gap: 1 }} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'Inset' })).toHaveValue('');
  });

  it('shows the default in a lone control for a value held as null', () => {
    renderWithIcons(
      <PrefControl pref={{ kind: 'number', name: 'Gap', description: '', default: 4 }} value={null} onChange={() => {}} />,
    );
    expect(screen.getByRole('spinbutton')).toHaveValue('4');
  });

  it("reads a list entry held as null as the item's default", () => {
    const list = { kind: 'list', name: 'Gaps', description: '', default: [], item: { kind: 'number', name: 'Gap', description: '', default: 4 } } as unknown as PrefList;
    expect(prefListEntry(list, null)).toBe(4);
  });
});
