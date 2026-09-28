import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox/Checkbox';
import { PropertyField } from './Properties/PropertyField';
import shared from './checkbox.module.css';

// CSS modules are not processed in the `weasel-ui` vitest project, so these
// assert the contract — that the shared class is on the native input — not
// the pixels.
describe('shared checkbox skin', () => {
  it('Checkbox draws its box from a native input wearing the shared class', () => {
    render(<Checkbox>Snap</Checkbox>);
    const input = screen.getByRole('checkbox', { name: 'Snap' });
    expect(input.tagName).toBe('INPUT');
    expect(input.className.split(' ')).toContain(shared.checkbox);
    // Not tucked into a visually hidden wrapper: the input is the box.
    expect(input.parentElement?.tagName).toBe('LABEL');
    expect(input.parentElement?.getAttribute('style')).toBeNull();
  });

  it('a checkbox field wears the shared class', () => {
    render(<PropertyField kind="boolean" label="Visible" value onChange={() => {}} />);
    const input = screen.getByRole('checkbox', { name: 'Visible' });
    expect(input.className.split(' ')).toContain(shared.checkbox);
  });

  it('Checkbox toggles from the keyboard and from its label text', async () => {
    const user = userEvent.setup();
    function Wrap() {
      const [on, setOn] = useState(false);
      return (
        <Checkbox isSelected={on} onChange={setOn}>
          Snap
        </Checkbox>
      );
    }
    render(<Wrap />);
    const input = screen.getByRole('checkbox', { name: 'Snap' }) as HTMLInputElement;
    await user.tab();
    expect(input).toHaveFocus();
    await user.keyboard(' ');
    expect(input.checked).toBe(true);
    await user.click(screen.getByText('Snap'));
    expect(input.checked).toBe(false);
  });

  it('Checkbox takes its name from aria-label when it has no children', () => {
    render(<Checkbox aria-label="Hide panel" />);
    expect(screen.getByRole('checkbox', { name: 'Hide panel' })).toBeTruthy();
  });

  it('Checkbox reports invalid and read-only through ARIA', async () => {
    const user = userEvent.setup();
    render(
      <Checkbox isInvalid isReadOnly>
        Locked
      </Checkbox>,
    );
    const input = screen.getByRole('checkbox', { name: 'Locked' }) as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-readonly', 'true');
    await user.click(input);
    expect(input.checked).toBe(false);
  });
});
