import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

// Count is auto with no resolver: only the instrument knows what it came to.
const counted = defineInstrument({
  name: 'Counted',
  config: f.schema({ count: f.number(3).range(1, 20).initial(auto).auto() }),
  initialState: () => ({}),
  render: (ctx) => (
    <>
      <button type="button" onClick={() => ctx.reportAuto('count', 7)}>
        report seven
      </button>
      <button type="button" onClick={() => ctx.reportAuto('count', 9)}>
        report nine
      </button>
      <output>{String((ctx.config as { count?: number }).count)}</output>
    </>
  ),
});

const quoted = (): string | null => {
  const label = screen.getByText('Count');
  fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
  fireEvent.pointerEnter(label, { pointerType: 'mouse' });
  const text = screen.queryByRole('tooltip')?.textContent ?? null;
  fireEvent.pointerLeave(label, { pointerType: 'mouse' });
  return text;
};

const pin = () => screen.getByRole('button', { name: /Count/ });

describe('an instrument reporting an auto value', () => {
  it('has its settings row quote the report, never storing it', async () => {
    await renderSettled(<Lab instruments={[counted]} defaultInstrument="Counted" />, {
      wrapper: withIcons,
    });
    expect(quoted()).toBeNull();
    fireEvent.click(screen.getByText('report seven'));
    expect(quoted()).toBe('auto 7');
    // The instrument's own config still reads the path as auto.
    expect(screen.getByRole('status')).toHaveTextContent('undefined');
  });

  it('drops the report once the path is pinned, and ignores one made while pinned', async () => {
    await renderSettled(<Lab instruments={[counted]} defaultInstrument="Counted" />, {
      wrapper: withIcons,
    });
    fireEvent.click(screen.getByText('report seven'));
    fireEvent.click(pin());
    expect(pin()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('7');

    fireEvent.click(screen.getByText('report nine'));
    fireEvent.click(pin());
    expect(pin()).toHaveAttribute('aria-pressed', 'false');
    expect(quoted()).toBeNull();

    fireEvent.click(screen.getByText('report nine'));
    expect(quoted()).toBe('auto 9');
  });
});
