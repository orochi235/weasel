/**
 * `<Lab hide>` drops a contribution's button and keeps what it binds: hiding Undo and Redo takes the trial's
 * toolbar row away and leaves Mod+Z stepping the trial's history.
 */
import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

const Gridded = defineInstrument({
  name: 'Gridded',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({}),
  render: () => null,
});

const grid = () => screen.getByRole('checkbox', { name: 'Show grid' });

describe('hiding a trial button', () => {
  it('drops the undo row and still undoes and redoes from the keys', async () => {
    await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" hide={['undo', 'redo']} />,
      { wrapper: withIcons },
    );
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redo' })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Trial actions' })).toBeNull();
    fireEvent.click(grid());
    expect(grid()).not.toBeChecked();
    expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })).toBe(false);
    expect(grid()).toBeChecked();
    expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true })).toBe(
      false,
    );
    expect(grid()).not.toBeChecked();
  });

  it('keeps Mod+S saving a snapshot once its button is hidden', async () => {
    await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" hide={['snapshot']} />,
      { wrapper: withIcons },
    );
    expect(screen.queryByRole('button', { name: 'Save snapshot' })).toBeNull();
    expect(fireEvent.keyDown(document.body, { key: 's', ctrlKey: true })).toBe(false);
    expect(await screen.findByRole('button', { name: 'Load snapshot' })).toBeInTheDocument();
  });

  it('throws on an id that is not there, as suppress does', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      renderSettled(<Lab instruments={[Gridded]} defaultInstrument="Gridded" hide={['nope']} />, {
        wrapper: withIcons,
      }),
    ).rejects.toThrow(/cannot hide "nope"/);
  });
});
