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
  return screen.getByRole('button', { name: /Toggle no paint for fill/ });
}

describe('ActiveSwatches', () => {
  it('renders one color input per paint role', () => {
    mount();
    expect(screen.getByLabelText('Fill color')).toBeTruthy();
    expect(screen.getByLabelText('Stroke color')).toBeTruthy();
  });

  it('None toggles the focused swatch and reports it as pressed', () => {
    const none = mount();
    expect(none.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(none);
    expect(none.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.wd-swatch--fill')?.classList.contains('is-none')).toBe(true);
    fireEvent.click(none);
    expect(none.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps each color input out of any button, so no control nests inside another', () => {
    mount();
    for (const name of ['Fill color', 'Stroke color']) {
      expect(screen.getByLabelText(name).closest('button')).toBeNull();
    }
  });

  it('shift-click on a swatch toggles it to none without opening the picker', () => {
    mount();
    const input = screen.getByLabelText('Stroke color');
    const notPrevented = fireEvent.click(input, { shiftKey: true });
    expect(notPrevented).toBe(false);
    expect(document.querySelector('.wd-swatch--stroke')?.classList.contains('is-none')).toBe(true);
    expect(document.querySelector('.wd-swatch--stroke')?.classList.contains('is-focused')).toBe(true);
  });
});
