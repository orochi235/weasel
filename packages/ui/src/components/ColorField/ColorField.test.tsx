import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorField } from './ColorField';

describe('ColorField', () => {
  it('renders the rgb value in the color input', () => {
    render(<ColorField value="#ff000080" alpha onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
  });

  it('shows a color written as rgba() or by name as its hex, and one it cannot read as black', () => {
    const shown = (value: string) => {
      const { unmount } = render(<ColorField value={value} alpha onChange={() => {}} />);
      const out = [(screen.getByLabelText('Color') as HTMLInputElement).value, (screen.getByRole('slider') as HTMLInputElement).value];
      unmount();
      return out;
    };
    expect(shown('rgba(20, 40, 60, 0.5)')).toEqual(['#14283c', '50']);
    expect(shown('rebeccapurple')).toEqual(['#663399', '100']);
    expect(shown('rgb(from red r g b / 50%)')).toEqual(['#000000', '100']);
  });

  it('emits live onInput and a single commit onChange on blur', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<ColorField value="#112233ff" alpha onInput={onInput} onChange={onChange} aria-label="Fill" />);
    const input = screen.getByLabelText('Fill');
    fireEvent.input(input, { target: { value: '#445566' } });
    expect(onInput).toHaveBeenCalledWith('#445566ff');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#445566ff');
  });

  it('commits when the picker closes, and not again on the blur that follows', () => {
    const onChange = vi.fn();
    render(<ColorField value="#112233ff" alpha onChange={onChange} aria-label="Fill" />);
    const input = screen.getByLabelText('Fill');
    fireEvent.input(input, { target: { value: '#445566' } });
    fireEvent(input, new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#445566ff');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not commit on blur with no preceding input (no-op-blur guard)', () => {
    const onChange = vi.fn();
    render(<ColorField value="#112233ff" alpha onChange={onChange} aria-label="Fill" />);
    const input = screen.getByLabelText('Fill');
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits alpha on pointer-up of the opacity slider', () => {
    const onChange = vi.fn();
    render(<ColorField value="#11223380" alpha onChange={onChange} aria-label="Fill" />);
    const slider = screen.getByLabelText('Fill opacity');
    fireEvent.input(slider, { target: { value: '100' } });
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#112233ff');
  });

  it('does not double-commit when blur follows pointer-up', () => {
    const onChange = vi.fn();
    render(<ColorField value="#11223380" alpha onChange={onChange} aria-label="Fill" />);
    const slider = screen.getByLabelText('Fill opacity');
    fireEvent.input(slider, { target: { value: '100' } });
    fireEvent.pointerUp(slider);
    fireEvent.blur(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('mixed renders the indeterminate chip and no value', () => {
    const { container } = render(<ColorField mixed alpha onChange={() => {}} aria-label="Fill" />);
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('mixed disables the opacity slider until the first color edit', () => {
    render(<ColorField mixed alpha onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByLabelText('Fill opacity')).toBeDisabled();
  });

  it('hides the opacity slider without alpha', () => {
    render(<ColorField value="#112233" onChange={() => {}} aria-label="Fill" />);
    expect(screen.queryByLabelText('Fill opacity')).toBeNull();
  });
});
