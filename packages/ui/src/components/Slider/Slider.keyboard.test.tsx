import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Slider } from './Slider';

describe('Slider keyboard', () => {
  it('arrow right increments by step and fires onInput + onChange', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} step={1} thumbs={[{ value: 5 }]} onInput={onInput} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onInput.mock.calls[0][0][0].value).toBe(6);
    expect(onChange.mock.calls[0][0][0].value).toBe(6);
  });

  it('shift+arrow moves by 10 steps; PageUp/Down do the same', () => {
    // Drive a controlled Slider so each keystroke sees the updated value.
    function Harness() {
      const [v, setV] = useState(50);
      return (
        <Slider
          min={0}
          max={100}
          step={1}
          thumbs={[{ value: v }]}
          onInput={ts => setV(ts[0].value)}
        />
      );
    }
    const { container } = render(<Harness />);
    let thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight', shiftKey: true });
    thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuenow')).toBe('60');
    fireEvent.keyDown(thumb, { key: 'PageDown' });
    thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  });

  it('Home snaps to min, End snaps to max', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} step={1} thumbs={[{ value: 5 }]} onInput={onInput} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onInput.mock.calls[0][0][0].value).toBe(0);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onInput.mock.calls[1][0][0].value).toBe(10);
  });

  it('exposes ARIA attributes on each thumb', () => {
    const { container } = render(
      <Slider min={0} max={1} thumbs={[{ value: 0.25 }]} ariaLabel="Hue" onInput={() => {}} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-orientation')).toBe('horizontal');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('1');
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.25');
    expect(thumb.getAttribute('aria-label')).toBe('Hue');
  });
});

describe('Slider fractional step', () => {
  it('reports a stepped value without float dust', () => {
    const onInput = vi.fn();
    const { getByRole } = render(<Slider min={0} max={1} step={0.1} thumbs={[{ value: 0.2 }]} onInput={onInput} />);
    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 0.3 }]);
  });
});
