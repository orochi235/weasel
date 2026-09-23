import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActiveSwatches } from './ActiveSwatches';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';

function mount() {
  render(
    <ColorContextProvider initialFocus="fill">
      <ActiveSwatches />
    </ColorContextProvider>,
  );
  return screen.getByRole('button', { name: 'None' });
}

const chip = (name: string) => screen.getByLabelText(name).parentElement!;

describe('ActiveSwatches', () => {
  it('renders one color input per paint role', () => {
    mount();
    expect(screen.getByLabelText('Fill')).toBeTruthy();
    expect(screen.getByLabelText('Stroke')).toBeTruthy();
  });

  it('None toggles the focused swatch and reports it as pressed', () => {
    const none = mount();
    expect(none.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(none);
    expect(none.getAttribute('aria-pressed')).toBe('true');
    expect(chip('Fill').hasAttribute('data-none')).toBe(true);
    fireEvent.click(none);
    expect(none.getAttribute('aria-pressed')).toBe('false');
  });

  it('shift-click on a swatch toggles it to none without opening the picker', () => {
    mount();
    const notPrevented = fireEvent.click(screen.getByLabelText('Stroke'), { shiftKey: true });
    expect(notPrevented).toBe(false);
    expect(chip('Stroke').hasAttribute('data-none')).toBe(true);
    expect(chip('Stroke').hasAttribute('data-focused')).toBe(true);
  });

  it('Swap exchanges the paints, and a pick lands on the focused chip', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    const fill = screen.getByLabelText('Fill');
    expect(fill).toHaveValue('#000000');
    fireEvent.input(fill, { target: { value: '#ff0000' } });
    expect(fill).toHaveValue('#ff0000');
  });
});
