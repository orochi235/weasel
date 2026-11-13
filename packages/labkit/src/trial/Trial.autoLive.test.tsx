import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

const counted = defineInstrument({
  name: 'Counted',
  config: f.schema({ count: f.number(16).range(1, 64).initial(auto).quote() }),
  initialState: () => ({}),
  render: (ctx) => <output>{String((ctx.config as { count?: number }).count)}</output>,
});

const pin = () => screen.getByRole('button', { name: 'Pin Count' });

describe('an auto setting in a trial falls off when edited', () => {
  it('pins on a drag of its live slider, and goes back to auto from its label', async () => {
    await renderSettled(<Lab instruments={[counted]} />, {
      wrapper: withIcons,
    });
    expect(pin()).toHaveAttribute('aria-pressed', 'false');
    const slider = screen.getByRole('slider', { name: 'Count' });
    expect(slider).toHaveValue('16');

    fireEvent.change(slider, { target: { value: '40' } });
    expect(pin()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('40');

    fireEvent.click(pin());
    expect(pin()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('undefined');
  });
});
