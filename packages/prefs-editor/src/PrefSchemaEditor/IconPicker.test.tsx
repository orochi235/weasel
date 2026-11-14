import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { IconPicker } from './IconPicker';

const ui: IconTable = { namespace: 'ui', owner: '@weasel-js/ui', icons: {
  close: { body: '<path d="c"/>', group: 'View', tags: ['dismiss'] },
  add: { body: '<path d="a"/>', group: 'Actions', tags: [] },
  remove: { body: '<path d="r"/>', group: 'Actions', tags: [] },
} };

const setup = (onChange = vi.fn(), props: { value?: string } = {}) => {
  const loader = vi.fn(async () => ({ default: [ui] }));
  render(
    <IconRegistryProvider variants={{ all: loader }}>
      <IconPicker value={props.value} onChange={onChange} />
    </IconRegistryProvider>,
  );
  return { onChange, loader };
};

describe('IconPicker', () => {
  it('loads the all variant and lists its icons by qualified name', async () => {
    const { loader } = setup();
    await waitFor(() => expect(screen.getByRole('option', { name: 'ui:close' })).toBeTruthy());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('filters by tag through the shared search', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'ui:add' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dismiss' } });
    expect(screen.queryByRole('option', { name: 'ui:add' })).toBeNull();
    expect(screen.getByRole('option', { name: 'ui:close' })).toBeTruthy();
  });

  it('writes the qualified name on choice', async () => {
    const { onChange } = setup();
    fireEvent.click(await screen.findByRole('option', { name: 'ui:close' }));
    expect(onChange).toHaveBeenLastCalledWith('ui:close');
  });

  it('marks the value chosen', async () => {
    setup(vi.fn(), { value: 'ui:add' });
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option', { selected: true }).map((o) => o.getAttribute('aria-label'))).toEqual(['ui:add']);
  });

  it('moves through the grid with the arrow keys and chooses with Enter', async () => {
    const { onChange } = setup();
    const grid = await screen.findByRole('listbox');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('ui:add');
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('ui:close');
  });

  it('jumps to the first and last icon with Home and End', async () => {
    const { onChange } = setup();
    const grid = await screen.findByRole('listbox');
    fireEvent.keyDown(grid, { key: 'End' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('ui:remove');
    fireEvent.keyDown(grid, { key: 'Home' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('ui:close');
  });

  it('keeps focus on the listbox when a cell is clicked, so the keys still work', async () => {
    const { onChange } = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('option', { name: 'ui:add' }));
    expect(document.activeElement).toBe(screen.getByRole('listbox'));
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('ui:remove');
  });
});
