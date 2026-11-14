import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { ActiveSwatches } from './ActiveSwatches';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { renderWithIcons } from './testIcons';

function mount() {
  renderWithIcons(
    <ColorContextProvider initialFocus="fill">
      <ActiveSwatches />
    </ColorContextProvider>,
  );
  return screen.getByRole('button', { name: 'None' });
}

const trigger = (name: string) => screen.getByRole('button', { name, hidden: true });
const chip = (name: string) => trigger(name).parentElement!;

/** Opens a chip's paint editor. */
function open(name: string): HTMLElement {
  fireEvent.click(trigger(name));
  return screen.getByRole('dialog', { name: `${name} editor` });
}

describe('ActiveSwatches', () => {
  it('renders one paint editor trigger per paint role', () => {
    mount();
    expect(trigger('Fill')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger('Stroke')).toHaveAttribute('aria-haspopup', 'dialog');
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

  it('shift-click on a swatch toggles it to none without opening the editor', () => {
    mount();
    fireEvent.click(trigger('Stroke'), { shiftKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chip('Stroke').hasAttribute('data-none')).toBe(true);
    expect(chip('Stroke').hasAttribute('data-focused')).toBe(true);
  });

  it('Swap exchanges the paints', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    const input = open('Fill').querySelector('input[type="color"]') as HTMLInputElement;
    expect(input).toHaveValue('#000000');
  });

  it('turns the active fill into a gradient, and edits it as one', () => {
    mount();
    fireEvent.click(within(open('Fill')).getByRole('radio', { name: 'Linear' }));
    const stop = within(screen.getByRole('dialog', { name: 'Fill editor' })).getByLabelText('Stop 1');
    fireEvent.input(stop, { target: { value: '#00ff00' } });
    fireEvent.blur(stop);
    expect(within(screen.getByRole('dialog', { name: 'Fill editor' })).getByLabelText('Stop 1')).toHaveValue('#00ff00');
  });
});
