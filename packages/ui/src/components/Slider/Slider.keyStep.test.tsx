import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Slider } from './Slider';

describe('Slider keyStep', () => {
  // A log2 track: the user counts in the amount, not in the exponent.
  const byOne = (thumb: { value: number }, steps: number) => Math.log2(2 ** thumb.value + steps);

  it('sends an arrow key where the caller says, in place of one step', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} step={0.001} thumbs={[{ value: 4 }]} keyStep={byOne} onInput={onInput} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: Math.log2(17) }]);
    expect(onChange).toHaveBeenLastCalledWith([{ value: Math.log2(17) }]);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft', shiftKey: true });
    expect(onInput).toHaveBeenLastCalledWith([{ value: Math.log2(6) }]);
    fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: Math.log2(26) }]);
  });

  it('still clamps to the track, and leaves Home and End alone', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={4.01} step={0.001} thumbs={[{ value: 4 }]} keyStep={byOne} onInput={onInput} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 4.01 }]);
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 0 }]);
  });
});

describe('Slider drag callbacks', () => {
  it('calls the onInput of the latest render through a drag, not the one from pointerdown', () => {
    const seen: number[] = [];
    function Counting() {
      const [moves, setMoves] = useState(0);
      return (
        <Slider
          min={0}
          max={1}
          step={0.01}
          thumbs={[{ value: 0.5 }]}
          onInput={() => {
            seen.push(moves);
            setMoves(moves + 1);
          }}
        />
      );
    }
    const { container } = render(<Counting />);
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    thumb.parentElement!.getBoundingClientRect = () =>
      ({ x: 0, y: 0, left: 0, top: 0, width: 200, height: 24, right: 200, bottom: 24, toJSON: () => ({}) }) as DOMRect;
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 12, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 12, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 12, pointerId: 1 });
    expect(seen).toEqual([0, 1, 2]);
    fireEvent.pointerUp(document, { clientX: 160, clientY: 12, pointerId: 1 });
  });
});
