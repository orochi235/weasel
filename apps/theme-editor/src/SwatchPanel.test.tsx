import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
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
});
