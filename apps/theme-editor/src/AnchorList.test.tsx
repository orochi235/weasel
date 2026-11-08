import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { AnchorList } from './AnchorList';

const RED = { name: 'red', hue: 25, lightness: 0.6 };

describe('<AnchorList>', () => {
  afterEach(cleanup);

  it('sets a hue typed into its field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIcons(<AnchorList anchors={[RED]} onChange={onChange} />);
    const hue = screen.getByRole('textbox', { name: /red hue/ });
    await user.clear(hue);
    await user.type(hue, '120{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([{ ...RED, hue: 120 }]);
  });

  it('keeps the lightness it had when its field is cleared', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIcons(<AnchorList anchors={[RED]} onChange={onChange} />);
    const lightness = screen.getByRole('textbox', { name: /red lightness/ });
    await user.clear(lightness);
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('unpins an anchor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIcons(<AnchorList anchors={[RED, { ...RED, name: 'blue' }]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Unpin red' }));
    expect(onChange).toHaveBeenCalledWith([{ ...RED, name: 'blue' }]);
  });
});
