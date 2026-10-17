import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { IconAttrField } from './IconAttrField';

const ui: IconTable = { namespace: 'ui', owner: '@weasel-js/ui', icons: {
  close: { body: '<path d="c"/>', group: 'View', tags: ['dismiss'] },
  add: { body: '<path d="a"/>', group: 'Actions', tags: [] },
} };

const setup = (onChange = vi.fn()) => {
  const loader = vi.fn(async () => ({ default: [ui] }));
  render(<IconRegistryProvider variants={{ all: loader }}><IconAttrField value={undefined} onChange={onChange} /></IconRegistryProvider>);
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
});
