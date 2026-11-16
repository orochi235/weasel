import { screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { Profiler } from 'react';
import { expect, it } from 'vitest';
import { LayerList, type LayerListItem } from './LayerList';

const ITEMS: LayerListItem[] = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];

it('renders once per update, not a second time to re-attach its container ref', () => {
  let commits = 0;
  const tree = (title: string) => (
    <Profiler id="list" onRender={() => { commits++; }}>
      <LayerList items={ITEMS} title={title} />
    </Profiler>
  );
  const { rerender } = renderWithIcons(tree('one'));
  commits = 0;
  rerender(tree('two'));
  expect(commits).toBe(1);
});

it('marks a non-printing row, and offers only the controls its row allows', () => {
  renderWithIcons(
    <LayerList
      items={[
        { id: 'notes', label: 'Measurements', nonPrinting: true, removable: false, children: [
          { id: 'm1', label: 'Measurement', nonPrinting: true, hideable: false },
        ] },
        { id: 'box', label: 'Box', hideable: false, removable: false },
      ]}
      onVisibilityChange={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(screen.getAllByText('Not printed')).toHaveLength(2);
  expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Show Measurements']);
  expect(screen.getAllByRole('button', { name: /^Remove/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Remove Measurement']);
});

it('keeps the remove column in a row that cannot be removed, beside one that can', () => {
  // A proxy for the alignment `LayerList.browser.test.tsx` measures: every row holds one item in that column.
  renderWithIcons(
    <LayerList items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', removable: false }]} onRemove={() => {}} onVisibilityChange={() => {}} />,
  );
  const tails = screen.getAllByRole('checkbox').map((box) => box.parentElement!.lastElementChild!);
  expect(tails[0]).toBe(screen.getByRole('button', { name: 'Remove Alpha' }));
  expect(tails[1]!.className).toMatch(/removeSlot/);
});
