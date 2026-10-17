import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { IconAttrField } from './IconAttrField';

const ui: IconTable = { namespace: 'ui', owner: '@weasel-js/ui', icons: {
  close: { body: '<path d="c"/>', group: 'View', tags: ['dismiss'] },
  add: { body: '<path d="a"/>', group: 'Actions', tags: [] },
  remove: { body: '<path d="r"/>', group: 'Actions', tags: [] },
} };

const setup = (onChange = vi.fn(), props: { value?: string; mixed?: boolean } = {}) => {
  const loader = vi.fn(async () => ({ default: [ui] }));
  render(
    <IconRegistryProvider variants={{ all: loader }}>
      <IconAttrField value={props.value} mixed={props.mixed} onChange={onChange} />
    </IconRegistryProvider>,
  );
  return { onChange, loader };
};

describe('IconAttrField', () => {
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

  it('writes the qualified name on choice, and clears it', async () => {
    const { onChange } = setup();
    fireEvent.click(await screen.findByRole('option', { name: 'ui:close' }));
    expect(onChange).toHaveBeenLastCalledWith('ui:close');
    fireEvent.click(screen.getByRole('button', { name: 'No icon' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
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

  it('says the selection holds several icons, and marks none of them chosen', async () => {
    setup(vi.fn(), { mixed: true });
    await screen.findByRole('listbox');
    expect(screen.getByText('Mixed')).toBeTruthy();
    expect(screen.queryAllByRole('option', { selected: true })).toEqual([]);
  });

  it('marks a value no table holds, once the icons have loaded', async () => {
    setup(vi.fn(), { value: 'ui:gone' });
    await screen.findByRole('listbox');
    expect(screen.getByText('ui:gone')).toBeTruthy();
    expect(screen.getByText('Not registered')).toBeTruthy();
  });

  it('does not mark a registered value', async () => {
    setup(vi.fn(), { value: 'ui:close' });
    await screen.findByRole('listbox');
    expect(screen.queryByText('Not registered')).toBeNull();
  });
});
