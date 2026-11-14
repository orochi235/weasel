import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Disabled, ReadOnly } from '../Disabled';
import { SegmentedBar } from './SegmentedBar';

const AB = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe('SegmentedBar held', () => {
  it('refuses a choice in single mode when disabled, natively with no reason', () => {
    const onChange = vi.fn();
    render(<SegmentedBar disabled items={AB} value="a" onChange={onChange} />);
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b).toBeDisabled();
    fireEvent.click(b);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps segments focusable under a reason, describing why, and refuses presses', () => {
    const onChange = vi.fn();
    render(<SegmentedBar mode="multiple" disabled disabledReason="Nothing selected" items={AB} value={[]} onChange={onChange} />);
    const b = screen.getByRole('button', { name: 'B' });
    expect(b).not.toBeDisabled();
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.getAttribute('aria-description')).toBe('Nothing selected');
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('holds an each-mode bar inside a Disabled scope', () => {
    const onChange = vi.fn();
    render(<Disabled reason="Locked"><SegmentedBar mode="each" items={[{ value: 'g', label: 'Grid', selected: false, onChange }]} /></Disabled>);
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('holds a value-showing bar read-only, but not a momentary bar’s action buttons', () => {
    const onChange = vi.fn();
    const onAction = vi.fn();
    render(
      <ReadOnly reason="Shared">
        <SegmentedBar aria-label="Pick" items={AB} value="a" onChange={onChange} />
        <SegmentedBar mode="momentary" aria-label="Do" items={[{ value: 'x', label: 'Export' }]} onAction={onAction} />
      </ReadOnly>,
    );
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b.hasAttribute('data-readonly')).toBe(true);
    fireEvent.click(b);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onAction).toHaveBeenCalledWith('x');
  });

  it('holds a momentary bar when disabled, from a click or the keyboard', () => {
    const onAction = vi.fn();
    render(<SegmentedBar mode="momentary" disabled disabledReason="Busy" items={[{ value: 'x', label: 'Export' }]} onAction={onAction} />);
    const x = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(x);
    fireEvent.keyDown(x, { key: 'Enter' });
    expect(onAction).not.toHaveBeenCalled();
  });
});
