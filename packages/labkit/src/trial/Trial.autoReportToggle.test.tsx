import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';

type Config = { count?: number };

// The README's pattern: report while the path is auto, withdraw while it is pinned.
function Counter({ ctx, suggested }: { ctx: RenderContext<unknown, Config>; suggested: unknown }) {
  const { reportAuto } = ctx;
  const autoCount = ctx.config.count === undefined;
  useEffect(
    () => reportAuto('count', autoCount ? suggested : undefined),
    [reportAuto, autoCount, suggested],
  );
  return null;
}

const counted = (suggested: unknown) =>
  defineInstrument({
    name: 'Counted',
    config: f.schema({ count: f.number(16).range(1, 64).initial(auto).quote() }),
    initialState: () => ({}),
    render: (ctx) => <Counter ctx={ctx as RenderContext<unknown, Config>} suggested={suggested} />,
  });

const readout = () => document.querySelector('.lk-control-panel [class*=readoutAfter]');
const pin = () => screen.getByRole('button', { name: /Count/ });

describe('a report made in the commit that turns its path auto', () => {
  it('reads out again after the path is pinned and unpinned', async () => {
    await renderSettled(<Lab instruments={[counted(48)]} />, {
      wrapper: withIcons,
    });
    expect(readout()).toHaveTextContent(/^auto · 48$/);
    fireEvent.click(pin());
    expect(pin()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(pin());
    expect(pin()).toHaveAttribute('aria-pressed', 'false');
    expect(readout()).toHaveTextContent(/^auto · 48$/);
  });

  it('withdraws a report of null, as it does undefined', async () => {
    await renderSettled(<Lab instruments={[counted(null)]} />, {
      wrapper: withIcons,
    });
    expect(readout()).toHaveTextContent(/^auto$/);
  });
});
