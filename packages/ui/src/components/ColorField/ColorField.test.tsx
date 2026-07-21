import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorField } from './ColorField';

describe('ColorField', () => {
  it('renders the rgb value in the color input', () => {
    render(<ColorField value="#ff000080" alpha onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
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

  it('commits alpha on pointer-up of the opacity slider', () => {
    const onChange = vi.fn();
    render(<ColorField value="#11223380" alpha onChange={onChange} aria-label="Fill" />);
    const slider = screen.getByLabelText('Opacity');
    fireEvent.input(slider, { target: { value: '100' } });
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#112233ff');
  });

  it('mixed renders the indeterminate chip and no value', () => {
    const { container } = render(<ColorField mixed alpha onChange={() => {}} aria-label="Fill" />);
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('hides the opacity slider without alpha', () => {
    render(<ColorField value="#112233" onChange={() => {}} aria-label="Fill" />);
    expect(screen.queryByLabelText('Opacity')).toBeNull();
  });
});
