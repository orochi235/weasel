import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';
import { stubRect } from './testing/stubRect';

describe('Slider click-on-track to add', () => {
  it('appends thumb returned by onAddThumb on track click', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onAddThumb = vi.fn((at: number) => ({ value: Math.round(at * 100) / 100 }));
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onChange={onChange}
        onAddThumb={onAddThumb}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(0.25);
    expect(onInput.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
    expect(onChange.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
  });

  it('null return is a no-op', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onAddThumb={() => null}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });
});

describe('Slider remove (drag-off and right-click)', () => {
  it('drag-off-vertical removes thumb on pointerup if onRemoveThumb returns true', () => {
    const onInput = vi.fn();
    const onRemoveThumb = vi.fn(() => true);
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
        onRemoveThumb={onRemoveThumb}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200, top: 0, bottom: 24, height: 24 });

    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    // Drag well below the track band — y > top + height + trackHeight (24 + 24 = 48).
    fireEvent.pointerMove(document, { clientX: 60, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 60, clientY: 100, pointerId: 1 });
    expect(onRemoveThumb).toHaveBeenCalledWith(0);
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last).toEqual([{ value: 0.7 }]);
  });

  it('right-click on thumb removes via onRemoveThumb', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
        onRemoveThumb={() => true}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.contextMenu(thumbs[1]);
    expect(onInput.mock.calls[0][0]).toEqual([{ value: 0.3 }]);
  });

  it('onRemoveThumb returning false leaves thumbs intact', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onRemoveThumb={() => false}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.contextMenu(thumb);
    expect(onInput).not.toHaveBeenCalled();
  });
});
