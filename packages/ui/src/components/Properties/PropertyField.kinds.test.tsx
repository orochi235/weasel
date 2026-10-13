import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { pick } from './testing/selectRow';

describe('color field', () => {
  it('emits the new hex on change', () => {
    const onChange = vi.fn();
    const { container } = render(<PropertyField kind="color" label="Fill" value="#ffffff" onChange={onChange} />);
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '#aa3300' } });
    expect(onChange).toHaveBeenCalledWith('#aa3300');
  });
});

describe('checkbox field', () => {
  it('toggles the boolean', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="boolean" label="Visible" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('switch field', () => {
  it('exposes a switch, not a checkbox, and toggles it', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="boolean" control="switch" label="Snap to grid" value={false} onChange={onChange} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Snap to grid' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects an absent value as off', () => {
    render(<PropertyField kind="boolean" control="switch" label="Snap to grid" value={undefined} onChange={() => {}} />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });
});

describe('text field', () => {
  it('emits the new text on change', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="string" label="Name" value="foo" onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('foo'), { target: { value: 'bar' } });
    expect(onChange).toHaveBeenCalledWith('bar');
  });
});

describe('number field', () => {
  it('emits a number on change', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="number" label="N" value={1} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('ignores non-finite values', () => {
    const onChange = vi.fn();
    render(<PropertyField kind="number" label="N" value={1} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('select field', () => {
  it('emits the selected option', () => {
    const onChange = vi.fn();
    render(
      <PropertyField
        kind="enum"
        label="Mode"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    pick('Mode', 'B');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('toggle field', () => {
  it('marks the active option checked and emits on click', () => {
    const onChange = vi.fn();
    render(
      <PropertyField
        kind="enum"
        control="toggle"
        label="Align"
        value="left"
        options={[
          { value: 'left', label: 'L' },
          { value: 'right', label: 'R' },
        ]}
        onChange={onChange}
      />,
    );
    const left = screen.getByText('L');
    const right = screen.getByText('R');
    expect(left).toHaveAttribute('aria-checked', 'true');
    expect(right).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(right);
    expect(onChange).toHaveBeenCalledWith('right');
  });

  // A <label> forwards a click on its text to its first control, which here is
  // the first option — so a near-miss on the pin dot selected an option.
  it('selects nothing when its label text is clicked', () => {
    const onChange = vi.fn();
    render(
      <PropertyField
        kind="enum"
        control="toggle"
        label="Align"
        value="right"
        options={[
          { value: 'left', label: 'L' },
          { value: 'right', label: 'R' },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Align'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
