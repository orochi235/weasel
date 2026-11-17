/**
 * A DOM trial's mode switch, beside Undo and Redo: it draws the trial's content in its own color mode while the
 * lab keeps its own, and switching it leaves the instrument mounted.
 */
import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { useThemeOptional } from '@weasel-js/theme/react';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

let mounts = 0;

function Probe() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <output aria-label="mode">{String(useThemeOptional()?.selection.mode)}</output>;
}

const Page = defineInstrument({
  name: 'Page',
  initialState: () => ({}),
  render: () => <Probe />,
});

const Painted = defineInstrument({
  name: 'Painted',
  initialState: () => ({}),
  canvas: { layers: [] },
  render: () => null,
});

const switchButton = () => screen.getByRole('button', { name: /^Trial theme:/ });

describe("a trial's color mode", () => {
  it('follows the lab until switched, then holds its own without remounting', async () => {
    mounts = 0;
    const { container } = await renderSettled(<Lab instruments={[Page]} mode="light" />, {
      wrapper: withIcons,
    });
    expect(screen.getByRole('status', { name: 'mode' })).toHaveTextContent('light');
    expect(switchButton()).toHaveAccessibleName('Trial theme: Auto — click for Light');

    fireEvent.click(switchButton());
    fireEvent.click(switchButton());
    expect(switchButton()).toHaveAccessibleName('Trial theme: Dark — click for Auto');
    expect(screen.getByRole('status', { name: 'mode' })).toHaveTextContent('dark');
    expect(container.querySelector('.lk-trial__themed')).toHaveAttribute('data-wzl-mode', 'dark');
    expect(container.querySelector('.lk-lab')).toHaveAttribute('data-wzl-mode', 'light');
    expect(mounts).toBe(1);

    fireEvent.click(switchButton());
    expect(screen.getByRole('status', { name: 'mode' })).toHaveTextContent('light');
  });

  it('is not offered on a trial that paints its own canvas', async () => {
    await renderSettled(<Lab instruments={[Painted]} />, { wrapper: withIcons });
    expect(screen.queryByRole('button', { name: /^Trial theme:/ })).toBeNull();
  });
});
