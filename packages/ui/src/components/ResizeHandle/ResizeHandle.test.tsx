import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ResizeHandle } from './ResizeHandle';

function setup(props: Partial<React.ComponentProps<typeof ResizeHandle>> = {}) {
  const onChange = vi.fn();
  const onChangeEnd = vi.fn();
  const { container } = render(
    <ResizeHandle
      value={260}
      min={200}
      max={600}
      onChange={onChange}
      onChangeEnd={onChangeEnd}
      ariaLabel="Resize sidebar"
      {...props}
    />,
  );
  const handle = container.querySelector<HTMLElement>('[role="separator"]')!;
  return { handle, onChange, onChangeEnd };
}

describe('ResizeHandle', () => {
  it('exposes the splitter value range to assistive tech', () => {
    const { handle } = setup();
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuenow')).toBe('260');
    expect(handle.getAttribute('aria-valuemin')).toBe('200');
    expect(handle.getAttribute('aria-valuemax')).toBe('600');
    expect(handle.tabIndex).toBe(0);
  });

  it('reports the size implied by the pointer offset', () => {
    const { handle, onChange } = setup();
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 540 });
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('measures every move against the gesture origin, not the last sample', () => {
    const { handle, onChange } = setup();
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 520 });
    fireEvent.pointerMove(handle, { clientX: 540 });
    // Not 260 + 20 + 20 applied to a moving base — both samples are absolute.
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('grows toward the start of the axis when inverted', () => {
    const { handle, onChange } = setup({ invert: true });
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 460 });
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('clamps to the bounds', () => {
    const { handle, onChange } = setup();
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 5000 });
    expect(onChange).toHaveBeenLastCalledWith(600);
    fireEvent.pointerMove(handle, { clientX: 0 });
    expect(onChange).toHaveBeenLastCalledWith(200);
  });

  it('snaps fractional pointer coordinates to the step grid', () => {
    const { handle, onChange, onChangeEnd } = setup();
    fireEvent.pointerDown(handle, { button: 0, clientX: 500.9453125 });
    fireEvent.pointerMove(handle, { clientX: 540.2 });
    expect(onChange).toHaveBeenLastCalledWith(299);
    fireEvent.pointerUp(handle, { clientX: 540.2 });
    expect(onChangeEnd).toHaveBeenLastCalledWith(299);
  });

  it('honors a fractional step', () => {
    const { handle, onChange } = setup({ step: 0.5 });
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 540.4 });
    expect(onChange).toHaveBeenLastCalledWith(300.5);
  });

  it('lets the bounds beat the step grid', () => {
    const { handle, onChange } = setup({ min: 205, max: 595, step: 10 });
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 5000 });
    expect(onChange).toHaveBeenLastCalledWith(595);
    fireEvent.pointerMove(handle, { clientX: 0 });
    expect(onChange).toHaveBeenLastCalledWith(205);
  });

  it('ignores moves that did not start with a drag', () => {
    const { handle, onChange } = setup();
    fireEvent.pointerMove(handle, { clientX: 540 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores non-primary buttons', () => {
    const { handle, onChange } = setup();
    fireEvent.pointerDown(handle, { button: 2, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 540 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits once on pointer up', () => {
    const { handle, onChangeEnd } = setup();
    fireEvent.pointerDown(handle, { button: 0, clientX: 500 });
    fireEvent.pointerMove(handle, { clientX: 520 });
    fireEvent.pointerMove(handle, { clientX: 540 });
    fireEvent.pointerUp(handle, { clientX: 540 });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd).toHaveBeenCalledWith(300);
  });

  it('steps with the arrow keys and commits each step', () => {
    const { handle, onChange, onChangeEnd } = setup({ step: 4 });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(264);
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(228);
    expect(onChangeEnd).toHaveBeenCalledTimes(2);
  });

  it('flips arrow direction when inverted', () => {
    const { handle, onChange } = setup({ invert: true, step: 4 });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(264);
  });

  it('jumps to the bounds with Home and End', () => {
    const { handle, onChange } = setup();
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(200);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(600);
  });

  it('drags along the cross axis when horizontal', () => {
    const { handle, onChange } = setup({ orientation: 'horizontal', value: 80, min: 40, max: 200 });
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    fireEvent.pointerDown(handle, { button: 0, clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 130 });
    expect(onChange).toHaveBeenLastCalledWith(110);
  });
});
