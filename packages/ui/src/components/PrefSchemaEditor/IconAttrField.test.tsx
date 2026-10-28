import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { IconAttrField } from './IconAttrField';

const ui: IconTable = { namespace: 'ui', owner: '@weasel-js/ui', icons: {
  close: { body: '<path d="c"/>', group: 'View', tags: [] },
  add: { body: '<path d="a"/>', group: 'Actions', tags: [] },
} };

const setup = (props: { value?: string; mixed?: boolean } = {}) => {
  const onChange = vi.fn();
  const loader = vi.fn(async () => ({ default: [ui] }));
  render(
    <IconRegistryProvider variants={{ all: loader }}>
      <IconAttrField value={props.value} mixed={props.mixed} onChange={onChange} />
    </IconRegistryProvider>,
  );
  return { onChange, loader };
};

describe('IconAttrField', () => {
  it('keeps the icons in a dialog, and closes it on a choice', async () => {
    const { onChange } = setup();
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));
    fireEvent.click(await screen.findByRole('option', { name: 'ui:add' }));
    expect(onChange).toHaveBeenLastCalledWith('ui:add');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('clears the icon', () => {
    const { onChange } = setup({ value: 'ui:close' });
    fireEvent.click(screen.getByRole('button', { name: 'No icon' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('says the selection holds several icons, and the dialog marks none of them chosen', async () => {
    setup({ mixed: true });
    expect(screen.getByText('Mixed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));
    await screen.findByRole('listbox');
    expect(screen.queryAllByRole('option', { selected: true })).toEqual([]);
  });

  it('marks a value no table holds, once the icons have loaded', async () => {
    setup({ value: 'ui:gone' });
    expect(screen.getByText('ui:gone')).toBeTruthy();
    expect(await screen.findByText('Not registered')).toBeTruthy();
  });

  it('does not mark a registered value', async () => {
    const { loader } = setup({ value: 'ui:close' });
    await waitFor(() => expect(loader).toHaveBeenCalled());
    expect(screen.queryByText('Not registered')).toBeNull();
  });
});
