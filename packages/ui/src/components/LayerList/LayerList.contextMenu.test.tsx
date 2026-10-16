import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerList } from './LayerList';

it('reports a right-click on a row with its id', () => {
  const onRowContextMenu = vi.fn();
  render(<LayerList items={[{ id: 'n1', label: 'Rect' }]} onRowContextMenu={onRowContextMenu} />);
  fireEvent.contextMenu(screen.getByText('Rect'));
  expect(onRowContextMenu).toHaveBeenCalledWith('n1', expect.anything());
});
