import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

const bare: Instrument = {
  name: 'Bare',
  initialState: () => ({}),
  render: () => null,
};

const notes: TrialContribution = {
  id: 'notes',
  region: 'sidebar',
  item: {
    title: 'Notes',
    body: (
      <p data-testid="notes-body" tabIndex={-1}>
        jot
      </p>
    ),
  },
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

async function renderLab() {
  return renderSettled(<Lab title="T" instruments={[bare]} chrome={[notes]} />, {
    wrapper: withIcons,
  });
}

describe('undocking a sidebar section', () => {
  it('starts docked inside the trial sidebar', async () => {
    const { container } = await renderLab();
    const sidebar = container.querySelector('.lk-trial__sidebar');
    expect(sidebar).toContainElement(screen.getByTestId('notes-body'));
  });

  it('moves the section out of the sidebar and into a workspace panel', async () => {
    const { container } = await renderLab();
    await userEvent.click(screen.getByRole('button', { name: 'Undock Notes' }));

    expect(container.querySelector('.lk-trial__sidebar')).not.toContainElement(
      screen.queryByTestId('notes-body'),
    );
    const panel = container.querySelector('.lk-panel-tile');
    expect(panel).toContainElement(screen.getByTestId('notes-body'));
  });

  it('docks it back', async () => {
    const { container } = await renderLab();
    await userEvent.click(screen.getByRole('button', { name: 'Undock Notes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dock Notes' }));

    expect(container.querySelector('.lk-panel-tile')).toBeNull();
    expect(container.querySelector('.lk-trial__sidebar')).toContainElement(
      screen.getByTestId('notes-body'),
    );
  });

  it('sends a section declaring undockAs floating to the floating layer', async () => {
    const { container } = await renderSettled(
      <Lab title="T" instruments={[bare]} chrome={[floater]} />,
      { wrapper: withIcons },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Undock Floater' }));

    const floating = container.querySelector('.lk-workspace__floating');
    expect(floating).toContainElement(screen.getByTestId('floater-body'));
    expect(container.querySelector('.lk-panel-tile--floating')).not.toBeNull();
  });

  it('keeps every trial mounted when the first floating panel appears', async () => {
    let mounts = 0;
    function Counted() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return null;
    }
    const counted: Instrument = { ...bare, render: () => <Counted /> };
    await renderSettled(<Lab title="T" instruments={[counted]} chrome={[floater]} />, {
      wrapper: withIcons,
    });
    expect(mounts).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Undock Floater' }));
    expect(screen.getByTestId('floater-body')).toBeInTheDocument();
    expect(mounts).toBe(1);
  });

  it('offers no tear-out control on a section that opts out', async () => {
    await renderSettled(<Lab title="T" instruments={[bare]} chrome={[pinned]} />, {
      wrapper: withIcons,
    });
    expect(screen.queryByRole('button', { name: 'Undock Pinned' })).toBeNull();
  });

  describe('when its trial leaves', () => {
    let lab: LabContextValue | null = null;
    const capture = (
      <LabContext.Consumer>
        {(value) => {
          if (value) lab = value;
          return null;
        }}
      </LabContext.Consumer>
    );

    async function undockInFirstOfTwo() {
      const view = await renderSettled(
        <Lab title="T" instruments={[bare]} chrome={[notes]}>
          {capture}
        </Lab>,
        { wrapper: withIcons },
      );
      await act(async () => lab?.addTrial('Bare'));
      const [undock] = screen.getAllByRole('button', { name: 'Undock Notes' });
      await userEvent.click(undock as HTMLElement);
      expect(view.container.querySelector('.lk-panel-tile')).not.toBeNull();
      return view;
    }

    it('sends a key pressed in the panel to its own trial, not the one focused last', async () => {
      const { container } = await undockInFirstOfTwo();
      const [first, second] = lab?.trials.map((t) => t.id) ?? [];
      const trials = container.querySelectorAll('.lk-trial');
      await act(async () => fireEvent.pointerDown(trials[1] as Element, { button: 0 }));
      expect(lab?.focusedTrialId).toBe(second);
      const spot = container.querySelector<HTMLElement>(
        '.lk-panel-tile [data-testid="notes-body"]',
      );
      await act(async () => spot?.focus());
      expect(lab?.focusedTrialId).toBe(first);
      await act(async () => fireEvent.keyDown(spot as HTMLElement, { key: 's', ctrlKey: true }));
      expect(lab?.savedSnapshots.map((s) => s.trialId)).toEqual([first]);
    });

    it('takes the panel with it on close', async () => {
      const { container } = await undockInFirstOfTwo();
      const first = lab?.trials[0]?.id ?? '';
      await act(async () => lab?.closeTrial(first));
      expect(container.querySelector('.lk-panel-tile')).toBeNull();
    });

    it('takes the panel with it on a swap', async () => {
      const { container } = await undockInFirstOfTwo();
      const first = lab?.trials[0]?.id ?? '';
      await act(async () => lab?.swapTrial(first, 'Bare'));
      expect(container.querySelector('.lk-panel-tile')).toBeNull();
    });
  });
});
