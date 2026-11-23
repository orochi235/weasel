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

  it.each([
    ['white', { name: 'white', hue: 87.3, lightness: 1 }, '87.3', '1'],
    ['dark', { name: 'dark', hue: 359.6, lightness: 0.2 }, '359.6', '0.2'],
  ])('shows a %s pinned color as it is, and leaves it so when its fields are tabbed through', async (_, anchor, hue, lightness) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIcons(<AnchorList anchors={[anchor]} onChange={onChange} />);
    const field = (part: string) => screen.getByRole('textbox', { name: new RegExp(`${anchor.name} ${part}`) });
    expect(field('hue')).toHaveValue(hue);
    expect(field('lightness')).toHaveValue(lightness);
    await user.click(field('hue'));
    await user.tab();
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

  it('points at a color picker only where the host offers one', () => {
    const { unmount } = renderWithIcons(<AnchorList anchors={[RED]} onChange={vi.fn()} />);
    expect(screen.getByText('Pinned colors keep their own lightness.')).toBeInTheDocument();
    unmount();
    renderWithIcons(<AnchorList anchors={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Nothing pinned — every color comes from the lightness law.')).toBeInTheDocument();
    cleanup();
    renderWithIcons(<AnchorList anchors={[RED]} onChange={vi.fn()} pickFrom="the panel below" />);
    expect(screen.getByText('Pinned colors keep their own lightness. Pick more from the panel below.')).toBeInTheDocument();
  });
});
