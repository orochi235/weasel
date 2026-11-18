import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { crayonAnchor } from './palette/crayons';
import { SwatchPanel } from './SwatchPanel';

describe('<SwatchPanel>', () => {
  afterEach(cleanup);

  it('moves between color sources with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithIcons(<SwatchPanel anchors={[]} onChange={() => {}} count={4} />);
    const named = screen.getByRole('tab', { name: /^Named/ });
    expect(named).toHaveAttribute('aria-selected', 'true');
    await user.click(named);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^LEGO/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('pins the typed hex color', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIcons(<SwatchPanel anchors={[]} onChange={onChange} count={4} />);
    const field = screen.getByRole('textbox', { name: 'Hex color to pin' });
    await user.clear(field);
    await user.type(field, '#123456');
    await user.click(screen.getByRole('button', { name: 'Pin' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });

  it('refuses a hex that is not six digits', async () => {
    const user = userEvent.setup();
    renderWithIcons(<SwatchPanel anchors={[]} onChange={() => {}} count={4} />);
    const field = screen.getByRole('textbox', { name: 'Hex color to pin' });
    await user.clear(field);
    await user.type(field, '#12');
    expect(screen.getByRole('button', { name: 'Pin' })).toBeDisabled();
  });

  it.each(['LEGO', 'Copic'])('shows a %s swatch it pinned as pressed, and unpins it on a second press', async (source) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(<SwatchPanel anchors={[]} onChange={onChange} count={8} />);
    await user.click(screen.getByRole('tab', { name: new RegExp(`^${source}`) }));
    const crayons = () => within(screen.getByRole('group', { name: 'Swatches to pin' }));
    const first = crayons().getAllByRole('button')[0]!;
    const label = first.getAttribute('aria-label')!;
    expect(first).toHaveAttribute('aria-pressed', 'false');
    await user.click(first);
    const pinned = onChange.mock.calls[0]![0];
    expect(pinned).toHaveLength(1);

    rerender(<SwatchPanel anchors={pinned} onChange={onChange} count={8} />);
    const again = crayons().getByRole('button', { name: label });
    expect(again).toHaveAttribute('aria-pressed', 'true');
    await user.click(again);
    expect(onChange.mock.calls[1]![0]).toEqual([]);
  });

  it('holds the unpinned swatches once every slot is pinned, saying why, and still unpins', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(<SwatchPanel anchors={[]} onChange={onChange} count={1} />);
    const crayons = () => within(screen.getByRole('group', { name: 'Swatches to pin' }));
    await user.click(crayons().getAllByRole('button')[0]!);
    rerender(<SwatchPanel anchors={onChange.mock.calls[0]![0]} onChange={onChange} count={1} />);
    const [pinned, other] = crayons().getAllByRole('button');
    expect(other).toHaveAttribute('aria-disabled', 'true');
    expect(other).toHaveAccessibleDescription(/Every slot is pinned/);
    await user.click(other!);
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.click(pinned!);
    expect(onChange.mock.calls[1]![0]).toEqual([]);
  });

  it('tells a pinned crayon from a LEGO swatch of the same name', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const crayon = crayonAnchor('lavender');
    renderWithIcons(<SwatchPanel anchors={[crayon]} onChange={onChange} count={8} />);
    await user.click(screen.getByRole('tab', { name: /^LEGO/ }));
    const lego = within(screen.getByRole('group', { name: 'Swatches to pin' })).getByRole('button', { name: 'Lavender' });
    expect(lego).toHaveAttribute('aria-pressed', 'false');
    await user.click(lego);
    const next = onChange.mock.calls[0]![0];
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(crayon);
  });
});
