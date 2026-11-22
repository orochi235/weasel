import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let seen: RenderContext<{ n: number }, Record<string, never>> | null = null;

const ruled = (rulers: boolean) =>
  defineInstrument<{ n: number }, Record<string, never>>({
    name: 'Ruled',
    initialState: () => ({ n: 0 }),
    render: (ctx) => {
      seen = ctx;
      return null;
    },
    canvas: { layers: [], ...(rulers ? { rulers: true } : {}) },
  });

describe('a trial whose canvas offers rulers', () => {
  it('offers a Guides menu, everything in it off until switched on', async () => {
    await renderSettled(<Lab instruments={[ruled(true)]} />, { wrapper: withIcons });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Guides' }));
    const rulers = screen.getByRole('menuitemcheckbox', { name: 'Show rulers' });
    expect(rulers).toHaveAttribute('aria-checked', 'false');
    await user.click(rulers);
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Guides' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show rulers' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('offers no Guides menu to a canvas that declares no rulers, and snaps nothing', async () => {
    await renderSettled(<Lab instruments={[ruled(false)]} />, { wrapper: withIcons });
    expect(screen.queryByRole('button', { name: 'Guides' })).toBeNull();
    act(() => {
      expect(seen?.trial.snap({ x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
    });
  });
});
