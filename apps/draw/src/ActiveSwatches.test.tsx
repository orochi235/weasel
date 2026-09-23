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
});
