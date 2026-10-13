import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';
import { stubRect } from './testing/stubRect';

describe('Slider track click', () => {
  const renderTrackClick = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={100}
        thumbs={[{ value: 10 }]}
        trackClick="move-nearest"
        onInput={onInput}
        onChange={onChange}
        {...props}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    const track = thumb.parentElement as HTMLElement;
    stubRect(track, { left: 0, width: 200 });
    return { track, thumb, onInput, onChange };
  };

  const lastValues = (fn: ReturnType<typeof vi.fn>): number[] =>
    fn.mock.calls[fn.mock.calls.length - 1][0].map((t: { value: number }) => t.value);

  it('moves a lone thumb to a track click by default', () => {
    const { track, onInput } = renderTrackClick({ trackClick: undefined });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([50]);
  });

  it('ignores a track click by default when there are several thumbs', () => {
    const { track, onInput } = renderTrackClick({ trackClick: undefined, thumbs: [{ value: 10 }, { value: 90 }] });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('ignores a track click when told to', () => {
    const { track, onInput } = renderTrackClick({ trackClick: 'none' });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('snaps the clicked value to the step', () => {
    const { track, onInput } = renderTrackClick({ step: 5 });
    fireEvent.pointerDown(track, { clientX: 105, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([55]);
  });

  it('focuses the thumb it moved, so the arrow keys carry on from there', () => {
    const { track, thumb } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(document.activeElement).toBe(thumb);
  });

  it('moves the only thumb to the clicked value', () => {
    const { track, onInput } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([50]);
  });

  it('moves the nearest thumb, leaving the others alone', () => {
    const { track, onInput } = renderTrackClick({ thumbs: [{ value: 10 }, { value: 90 }] });
    fireEvent.pointerDown(track, { clientX: 160, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([10, 80]);
  });

  it('lands the click on a stop', () => {
    const { track, onInput } = renderTrackClick({ stops: [0, 50, 100] });
    fireEvent.pointerDown(track, { clientX: 98, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([50]);
  });

  it('commits on release, not on the press', () => {
    const { track, onInput, onChange } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onInput).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(document, { clientX: 100, clientY: 12 });
    expect(lastValues(onChange)).toEqual([50]);
  });

  it('drags on from where the click landed', () => {
    const { track, onInput } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12 });
    expect(lastValues(onInput)).toEqual([75]);
  });

  it('lets onAddThumb win over the move', () => {
    const onAddThumb = vi.fn((v: number) => ({ value: v }));
    const { track, onInput } = renderTrackClick({ onAddThumb });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(50);
    expect(lastValues(onInput)).toEqual([10, 50]);
  });

  it('holds the moved thumb inside its bounds', () => {
    const { track, onInput } = renderTrackClick({ thumbs: [{ value: 10, bounds: [0, 30] }] });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([30]);
  });
});
