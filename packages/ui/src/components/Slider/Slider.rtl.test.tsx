import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Slider, type SliderProps, type TrackCtx } from './Slider';
import { stubRect } from './testing/stubRect';

function mount(props: Partial<SliderProps> = {}, dir: 'ltr' | 'rtl' = 'rtl') {
  const onInput = vi.fn();
  const { container } = render(
    <div dir={dir}>
      <Slider min={0} max={100} step={1} thumbs={[{ value: 25 }]} onInput={onInput} {...props} />
    </div>,
  );
  const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
  const rail = container.querySelector<HTMLElement>('[data-slider-rail]')!;
  stubRect(rail, { left: 0, width: 200 });
  return { container, thumb, rail, onInput };
}

const last = (fn: ReturnType<typeof vi.fn>): number[] => fn.mock.calls.at(-1)![0].map((t: { value: number }) => t.value);

describe('a straight Slider in a right-to-left locale', () => {
  it('lays its minimum at the right end', () => {
    expect(mount().thumb.style.left).toBe('75%');
    expect(mount({}, 'ltr').thumb.style.left).toBe('25%');
  });

  it('reads a press from the right end', () => {
    const { rail, onInput } = mount();
    fireEvent.pointerDown(rail, { clientX: 50, clientY: 12, button: 0 });
    expect(last(onInput)).toEqual([75]);
  });

  it('follows a drag the way the pointer goes on screen', () => {
    const { thumb, onInput } = mount();
    fireEvent.pointerDown(thumb, { clientX: 150, clientY: 12, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 12, pointerId: 1 });
    expect(last(onInput)).toEqual([90]);
  });

  it('steps down on ArrowRight and up on ArrowLeft, as a native range input does', () => {
    const { thumb, onInput } = mount();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(last(onInput)).toEqual([24]);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(last(onInput)).toEqual([26]);
    fireEvent.keyDown(thumb, { key: 'ArrowUp' });
    expect(last(onInput)).toEqual([26]);
  });

  it('puts the readouts under their thumbs and the first stop label at the right edge', () => {
    const { container } = mount({
      readoutPlacement: 'below-thumb',
      stops: [{ value: 0, label: 'lo' }, { value: 50, label: 'mid' }, { value: 100, label: 'hi' }],
    });
    expect(container.querySelector<HTMLElement>('[data-readout="below"]')!.style.left).toBe('75%');
    const edges = [...container.querySelectorAll<HTMLElement>('[data-slider-stop-label]')].map((el) => [el.textContent, el.dataset.edge]);
    expect(edges).toEqual([['lo', 'right'], ['mid', undefined], ['hi', 'left']]);
  });

  it('hands a track painter a span running from the right end', () => {
    let ctx: TrackCtx | undefined;
    mount({ renderTrack: (c): ReactNode => { ctx = c; return null; } });
    expect(ctx!.shape.direction).toBe('rtl');
  });
});
