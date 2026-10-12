import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BarField } from './BarField';

const options = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const;

/** The words a bar sets before a control. */
const barLabel = (root: HTMLElement): Element | null => root.querySelector('[data-bar-label]');

describe('BarField', () => {
  it('sets a number box behind its name, which the box keeps as its own', () => {
    const { container } = render(<BarField kind="number" name="Size" value={12} onChange={() => {}} />);
    expect(barLabel(container)).toHaveTextContent('Size');
    expect(barLabel(container)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
  });

  it('sets an icon before a value box in place of its name', () => {
    const { container } = render(
      <BarField kind="string" name="Title" value="" icon={<svg data-testid="glyph" />} onChange={() => {}} />,
    );
    expect(screen.getByTestId('glyph')).toBeInTheDocument();
    expect(barLabel(container)).not.toHaveTextContent('Title');
  });

  it('leaves a control that names itself with no label', () => {
    const { container } = render(
      <BarField kind="enum" name="Align" value="left" options={options} onChange={() => {}} />,
    );
    expect(barLabel(container)).toBeNull();
  });

  it('draws a flag as a button held down while it is on', () => {
    const onChange = vi.fn();
    render(<BarField kind="boolean" name="Bold" value={true} onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Bold' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('sets a switch or a checkbox before its name', () => {
    render(
      <>
        <BarField kind="boolean" control="switch" name="Snap" value={false} onChange={() => {}} />
        <BarField kind="boolean" control="checkbox" name="Grid" value={false} onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole('switch', { name: 'Snap' })).toBeInTheDocument();
    expect(screen.getByText('Snap')).toBeInTheDocument();
    const onChange = vi.fn();
    render(<BarField kind="boolean" control="checkbox" name="Guides" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('Guides'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('draws a radio enum as segments, which a bar has room for', () => {
    const { container } = render(
      <BarField kind="enum" control="radio" name="Align" value="left" options={options} onChange={() => {}} />,
    );
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Left', 'Right']);
  });

  it('draws a menu enum as a button reading the value, and writes the row chosen', () => {
    const onChange = vi.fn();
    render(<BarField kind="enum" control="menu" name="Align" value="left" options={options} onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Align: Left' });
    expect(button).toHaveTextContent('Left');
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('opens a text area from a button reading its name', () => {
    render(<BarField kind="string" control="textarea" name="Notes" value="hello" onChange={() => {}} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('hello');
  });

  it('draws a paint as a swatch, with its editor closed', () => {
    render(
      <BarField
        kind="paint"
        control="inline"
        name="Fill"
        value={{ kind: 'solid', color: '#ff0000' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Fill' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables the button a disabled text area opens from', () => {
    render(<BarField kind="string" control="textarea" name="Notes" value="" disabled onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Notes' })).toBeDisabled();
  });
});
