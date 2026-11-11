/**
 * `<Lab sidebar="float">` puts a trial's sidebar in a panel floating over its body, opened from the title bar,
 * instead of a pane beside the body.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

const Gridded = defineInstrument({
  name: 'Gridded',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({}),
  render: () => <div data-testid="body" />,
});

const Bare = defineInstrument({
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
});

// While the panel is open, a modal popover hides the rest of the page from the accessibility tree.
const toggle = () => screen.getByRole('button', { name: 'Trial settings', hidden: true });

describe('a floating trial sidebar', () => {
  it('lays no sidebar pane out beside the body, and offers a closed toggle in the title bar', async () => {
    await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" sidebar="float" />,
      {
        wrapper: withIcons,
      },
    );
    expect(document.querySelector('.lk-trial__sidebar')).toBeNull();
    expect(toggle().closest('.lk-trial__titlebar')).not.toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).toBeNull();
  });

  it('opens the sections in a dialog that writes the trial, and closes on Escape', async () => {
    await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" sidebar="float" />,
      {
        wrapper: withIcons,
      },
    );
    fireEvent.click(toggle());
    const dialog = screen.getByRole('dialog', { name: 'Gridded settings' });
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    const grid = within(dialog).getByRole('checkbox', { name: 'Show grid' });
    fireEvent.click(grid);
    expect(grid).not.toBeChecked();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle());
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).not.toBeChecked();
  });

  it('closes on a press outside it, and the toggle closes what it opened', async () => {
    await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" sidebar="float" />,
      {
        wrapper: withIcons,
      },
    );
    const user = userEvent.setup();
    await user.click(toggle());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('body'));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(toggle());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(toggle());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveFocus();
  });

  it('offers no toggle to a trial with no sections, and none once suppressed', async () => {
    const { unmount } = await renderSettled(
      <Lab instruments={[Bare]} defaultInstrument="Bare" sidebar="float" />,
      { wrapper: withIcons },
    );
    expect(screen.queryByRole('button', { name: 'Trial settings' })).toBeNull();
    unmount();
    await renderSettled(
      <Lab
        instruments={[Gridded]}
        defaultInstrument="Gridded"
        sidebar="float"
        suppress={['panel']}
      />,
      { wrapper: withIcons },
    );
    expect(screen.queryByRole('button', { name: 'Trial settings' })).toBeNull();
  });

  it('docks the sidebar by default, with no toggle, and suppressing the toggle there is no error', async () => {
    await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" suppress={['panel']} />,
      { wrapper: withIcons },
    );
    expect(document.querySelector('.lk-trial__sidebar')).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trial settings' })).toBeNull();
  });

  it('keeps a section torn out of the panel in the workspace once the panel closes', async () => {
    const notes: TrialContribution = {
      id: 'notes',
      region: 'sidebar',
      item: { title: 'Notes', body: <p data-testid="notes-body">jot</p> },
    };
    const { container } = await renderSettled(
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" sidebar="float" chrome={[notes]} />,
      { wrapper: withIcons },
    );
    const user = userEvent.setup();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Undock Notes' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('.lk-panel-tile')).toContainElement(
      screen.getByTestId('notes-body'),
    );
  });
});
