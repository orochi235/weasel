import { screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../../instrument/types';
import { Lab } from '../../lab/Lab';

const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="trial-content" />,
};

describe('the lab overlay region', () => {
  it('renders overlay contributions inside the lab surface, after the trials', async () => {
    await renderSettled(
      <Lab
        title="T"
        instruments={[bare]}
        defaultInstrument="Bare"
        labChrome={[{ id: 'x', region: 'overlay', render: () => <i data-testid="o" /> }]}
      />,
      { wrapper: withIcons },
    );
    const o = screen.getByTestId('o');
    const body = document.querySelector('.lk-lab__body') as HTMLElement;
    expect(body.contains(o)).toBe(true);
    // Source order stands in for stacking, which jsdom does not resolve.
    const trial = screen.getByTestId('trial-content');
    expect(trial.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hands an overlay render the lab chrome context', async () => {
    await renderSettled(
      <Lab
        title="T"
        instruments={[bare]}
        defaultInstrument="Bare"
        labChrome={[
          {
            id: 'x',
            region: 'overlay',
            render: (ctx) => <i data-testid="o">{ctx.instruments.length}</i>,
          },
        ]}
      />,
      { wrapper: withIcons },
    );
    expect(screen.getByTestId('o').textContent).toBe('1');
  });
});
