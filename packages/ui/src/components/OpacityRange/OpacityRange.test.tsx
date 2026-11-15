import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpacityRange } from './OpacityRange';

const range = () => screen.getByLabelText<HTMLInputElement>('Fill opacity');
const slide = (pct: number) => fireEvent.input(range(), { target: { value: String(pct) } });

describe('OpacityRange', () => {
  it('shows the drag in its readout and commits the alpha once at the end', () => {
    const onChange = vi.fn();
    const { container } = render(<OpacityRange aria-label="Fill" value={0.4} onChange={onChange} />);
    fireEvent.pointerDown(range());
    slide(55);
    slide(70);
    expect(container.textContent).toContain('70%');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(range(), { target: { value: '70' } });
    expect(onChange.mock.calls).toEqual([[0.7]]);
  });

  it('Escape puts the alpha back and reports the cancel', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(<OpacityRange aria-label="Fill" value={0.4} onInput={onInput} onChange={onChange} onCancel={onCancel} />);
    fireEvent.pointerDown(range());
    slide(80);
    fireEvent.keyDown(range(), { key: 'Escape' });
    expect(onInput.mock.calls.map((c) => c[0])).toEqual([0.8, 0.4]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(range());
    expect(onChange).not.toHaveBeenCalled();
  });
});
