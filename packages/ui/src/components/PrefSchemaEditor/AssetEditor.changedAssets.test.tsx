import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Live } from './AssetEditor.fixture';

afterEach(cleanup);

it('reports the assets that differ from the baseline when it mounts, and again when the set changes', () => {
  const onChangedAssets = vi.fn<(ids: ReadonlySet<string>) => void>();
  render(<Live onChangedAssets={onChangedAssets} />);
  expect(onChangedAssets).toHaveBeenCalledTimes(1);
  expect([...onChangedAssets.mock.lastCall![0]]).toEqual([]);

  const structure = screen.getByRole('tree', { name: 'Schema structure' });
  fireEvent.click(within(structure).getByText('Snap'));
  fireEvent.keyDown(structure, { key: 'Delete' });
  // The panel that pointed at the setting follows the dialog it was removed from.
  expect([...onChangedAssets.mock.lastCall![0]]).toEqual(['settings', 'code']);

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect([...onChangedAssets.mock.lastCall![0]]).toEqual([]);
});
