import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FillStyle } from '@weasel-js/core';
import { FillStrokeSwatch, type FillStrokeSwatchProps } from './FillStrokeSwatch';

const RED: FillStyle = { fill: 'solid', color: '#ff0000ff' };
const BLUE: FillStyle = { fill: 'solid', color: '#0000ffff' };

function mount(over: Partial<FillStrokeSwatchProps> = {}) {
  const props: FillStrokeSwatchProps = {
    fill: RED,
    stroke: BLUE,
    focused: 'fill',
    onFocusChange: vi.fn(),
    onChange: vi.fn(),
    ...over,
  };
  render(<FillStrokeSwatch {...props} />);
  return props;
}

describe('FillStrokeSwatch', () => {
  it('names the pair as a group and each chip by its slot', () => {
    mount();
    expect(screen.getByRole('group', { name: 'Fill and stroke' })).toBeInTheDocument();
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
    expect(screen.getByLabelText('Stroke')).toHaveValue('#0000ff');
  });

  it('marks the focused slot current', () => {
    mount({ focused: 'stroke' });
    expect(screen.getByLabelText('Stroke')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Fill')).not.toHaveAttribute('aria-current');
  });

  it('keeps each color input out of any button', () => {
    mount({ onToggleNone: vi.fn(), onSwap: vi.fn() });
    for (const name of ['Fill', 'Stroke']) {
      expect(screen.getByLabelText(name).closest('button')).toBeNull();
    }
  });

  it('focuses a slot on click or keyboard focus', () => {
    const p = mount();
    fireEvent.click(screen.getByLabelText('Stroke'));
    expect(p.onFocusChange).toHaveBeenCalledWith('stroke');
    fireEvent.focus(screen.getByLabelText('Fill'));
    expect(p.onFocusChange).toHaveBeenCalledWith('fill');
  });

  it('streams picker input and commits once on close', () => {
    const onInput = vi.fn();
    const p = mount({ onInput });
    const fill = screen.getByLabelText('Fill');
    fireEvent.input(fill, { target: { value: '#00ff00' } });
    fireEvent.input(fill, { target: { value: '#00ee00' } });
    fireEvent.blur(fill);
    expect(onInput.mock.calls).toEqual([['fill', '#00ff00'], ['fill', '#00ee00']]);
    expect(p.onChange).toHaveBeenCalledTimes(1);
    expect(p.onChange).toHaveBeenCalledWith('fill', '#00ee00');
  });

  it('commits nothing when the picker closes untouched', () => {
    const p = mount();
    fireEvent.blur(screen.getByLabelText('Fill'));
    expect(p.onChange).not.toHaveBeenCalled();
  });

  it('shift-click toggles none without opening the picker', () => {
    const p = mount({ onToggleNone: vi.fn() });
    const notPrevented = fireEvent.click(screen.getByLabelText('Stroke'), { shiftKey: true });
    expect(notPrevented).toBe(false);
    expect(p.onToggleNone).toHaveBeenCalledWith('stroke');
    expect(p.onFocusChange).toHaveBeenCalledWith('stroke');
  });

  it('leaves shift-click alone with no onToggleNone', () => {
    mount();
    expect(fireEvent.click(screen.getByLabelText('Stroke'), { shiftKey: true })).toBe(true);
  });

  it('None acts on the focused slot and reads pressed when it holds none', () => {
    const onToggleNone = vi.fn();
    mount({ fill: null, focused: 'fill', onToggleNone });
    const none = screen.getByRole('button', { name: 'None' });
    expect(none).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(none);
    expect(onToggleNone).toHaveBeenCalledWith('fill');
  });

  it('shows none as data-none on its chip', () => {
    mount({ stroke: null });
    expect(screen.getByLabelText('Stroke').parentElement).toHaveAttribute('data-none');
    expect(screen.getByLabelText('Fill').parentElement).not.toHaveAttribute('data-none');
  });

  it('renders Swap and Default only when handed their callbacks', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Swap' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Default' })).toBeNull();
  });

  it('fires onSwap and onReset', () => {
    const onSwap = vi.fn();
    const onReset = vi.fn();
    mount({ onSwap, onReset });
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('opens the picker on a non-solid paint at the slot fallback', () => {
    const grad: FillStyle = {
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#ff0000ff' }, { offset: 1, color: '#0000ffff' }], units: 'bounds',
    };
    mount({ fill: grad, stroke: null });
    expect(screen.getByLabelText('Fill')).toHaveValue('#ffffff');
    expect(screen.getByLabelText('Stroke')).toHaveValue('#000000');
  });
});
