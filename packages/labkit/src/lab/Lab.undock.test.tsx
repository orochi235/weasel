import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

const notes: TrialContribution = {
  id: 'notes',
  region: 'sidebar',
  item: { title: 'Notes', body: <p data-testid="notes-body">jot</p> },
};

const floater: TrialContribution = {
  id: 'floater',
  region: 'sidebar',
  item: {
    title: 'Floater',
    undockAs: 'floating',
    body: <p data-testid="floater-body">hover</p>,
  },
};

const pinned: TrialContribution = {
  id: 'pinned',
  region: 'sidebar',
  item: { title: 'Pinned', undockable: false, body: <p>stay</p> },
};

function renderLab() {
  return render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[notes]} />);
}

describe('undocking a sidebar section', () => {
  it('starts docked inside the trial sidebar', () => {
    const { container } = renderLab();
    const sidebar = container.querySelector('.lk-trial__sidebar');
    expect(sidebar).toContainElement(screen.getByTestId('notes-body'));
  });

  it('moves the section out of the sidebar and into a workspace panel', async () => {
    const { container } = renderLab();
    await userEvent.click(screen.getByRole('button', { name: 'Undock Notes' }));

    expect(container.querySelector('.lk-trial__sidebar')).not.toContainElement(
      screen.queryByTestId('notes-body'),
    );
    const panel = container.querySelector('.lk-panel-tile');
    expect(panel).toContainElement(screen.getByTestId('notes-body'));
  });

  it('docks it back', async () => {
    const { container } = renderLab();
    await userEvent.click(screen.getByRole('button', { name: 'Undock Notes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dock Notes' }));

    expect(container.querySelector('.lk-panel-tile')).toBeNull();
    expect(container.querySelector('.lk-trial__sidebar')).toContainElement(
      screen.getByTestId('notes-body'),
    );
  });

  it('sends a section declaring undockAs floating to the floating layer', async () => {
    const { container } = render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[floater]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Undock Floater' }));

    const floating = container.querySelector('.lk-workspace__floating');
    expect(floating).toContainElement(screen.getByTestId('floater-body'));
    expect(container.querySelector('.lk-panel-tile--floating')).not.toBeNull();
  });

  it('offers no tear-out control on a section that opts out', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[pinned]} />);
    expect(screen.queryByRole('button', { name: 'Undock Pinned' })).toBeNull();
  });
});
