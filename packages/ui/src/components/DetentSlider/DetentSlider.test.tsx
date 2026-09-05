import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DetentSlider } from './DetentSlider';

const RATES = [0.25, 0.5, 1, 2, 4];

function renderRate(props: Partial<Parameters<typeof DetentSlider<number>>[0]> = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const view = render(
    <DetentSlider
      ariaLabel="Playback rate"
      items={RATES}
      value={1}
      formatLabel={(r) => `${r}×`}
      onChange={onChange}
      onCommit={onCommit}
      {...props}
    />,
  );
  const thumb = view.container.querySelector('[role="slider"]') as HTMLElement;
  const track = thumb.parentElement as HTMLElement;
  const full: DOMRect = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}) };
  track.getBoundingClientRect = () => full;
  return { ...view, thumb, track, onChange, onCommit };
}

const ticks = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-slider-tick]'));
const labels = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-detent-label]'));

describe('DetentSlider spacing', () => {
  // The whole point: 0.25/0.5/1/2/4 is geometric, so a linear value track would
  // bunch four of the five detents into the first fifth of it.
  it('spaces detents evenly however the values are distributed', () => {
    const { container } = renderRate();
    expect(ticks(container).map((t) => t.dataset.fraction)).toEqual(['0', '0.25', '0.5', '0.75', '1']);
  });

  it('parks the thumb on its detent, not on its value', () => {
    const { thumb } = renderRate({ value: 1 });
    expect(thumb.style.left).toBe('50%');
  });

  it('spaces two detents at the ends', () => {
    const { container } = renderRate({ items: [10, 1000], value: 10 });
    expect(ticks(container).map((t) => t.dataset.fraction)).toEqual(['0', '1']);
  });

  it('renders a lone detent without dividing by zero', () => {
    const { container, thumb } = renderRate({ items: [1], value: 1 });
    expect(ticks(container)).toHaveLength(1);
    expect(thumb.style.left).toBe('0%');
  });
});

describe('DetentSlider labels', () => {
  it('labels every detent through formatLabel', () => {
    const { container } = renderRate();
    expect(labels(container).map((l) => l.textContent)).toEqual(['0.25×', '0.5×', '1×', '2×', '4×']);
  });

  it('falls back to the value when no format is given', () => {
    const { container } = renderRate({ formatLabel: undefined });
    expect(labels(container).map((l) => l.textContent)).toEqual(['0.25', '0.5', '1', '2', '4']);
  });

  it('takes an explicit label over the format', () => {
    const { container } = renderRate({ items: [0.25, { value: 1, label: 'normal' }, 4], value: 1 });
    expect(labels(container).map((l) => l.textContent)).toEqual(['0.25×', 'normal', '4×']);
  });

  it('labels only the ends when asked', () => {
    const { container } = renderRate({ labels: 'ends' });
    expect(labels(container).map((l) => l.textContent)).toEqual(['0.25×', '4×']);
  });

  it('drops the label row entirely when asked', () => {
    const { container } = renderRate({ labels: 'none' });
    expect(labels(container)).toHaveLength(0);
  });

  it('marks the selected label so it can be styled', () => {
    const { container } = renderRate({ value: 2 });
    expect(labels(container).map((l) => l.dataset.selected)).toEqual([undefined, undefined, undefined, 'true', undefined]);
  });

  // The thumb already announces the value as aria-valuetext; a second copy in
  // the tree would have a screen reader read every detent on focus.
  it('keeps the labels out of the accessibility tree', () => {
    const { container } = renderRate();
    expect(container.querySelector('[data-detent-labels]')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('DetentSlider accessibility', () => {
  it('announces the chosen value, not the index it rides on', () => {
    const { thumb } = renderRate({ value: 2 });
    expect(thumb.getAttribute('role')).toBe('slider');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('4');
    expect(thumb.getAttribute('aria-valuenow')).toBe('3');
    expect(thumb.getAttribute('aria-valuetext')).toBe('2×');
    expect(thumb.getAttribute('aria-label')).toBe('Playback rate');
  });

  it('prefers an item ariaLabel for the spoken form', () => {
    const { thumb } = renderRate({
      items: [0.25, { value: 1, label: '1×', ariaLabel: 'normal speed' }, 4],
      value: 1,
    });
    expect(thumb.getAttribute('aria-valuetext')).toBe('normal speed');
  });

  it('speaks a non-string label as its value', () => {
    const { thumb } = renderRate({ items: [{ value: 1, label: <b>one</b> }], value: 1 });
    expect(thumb.getAttribute('aria-valuetext')).toBe('1');
  });

  it('is focusable', () => {
    const { thumb } = renderRate();
    expect(thumb.getAttribute('tabindex')).toBe('0');
  });
});

describe('DetentSlider keyboard', () => {
  it('steps one detent per arrow press', () => {
    const { thumb, onChange } = renderRate({ value: 1 });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(2, 3);
  });

  it('steps back down', () => {
    const { thumb, onChange } = renderRate({ value: 1 });
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(0.5, 1);
  });

  it('holds at the ends', () => {
    const { thumb, onChange } = renderRate({ value: 4 });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('jumps to either end', () => {
    const { thumb, onChange } = renderRate({ value: 1 });
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0.25, 0);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(4, 4);
  });

  it('commits a keystroke, since there is no gesture to wait out', () => {
    const { thumb, onCommit } = renderRate({ value: 1 });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenCalledWith(2, 3);
  });
});

describe('DetentSlider pointer', () => {
  it('picks the detent nearest a track click', () => {
    const { track, onChange } = renderRate({ value: 1 });
    // 155/200 = 0.775, nearest detent 0.75 -> index 3 -> 2x.
    fireEvent.pointerDown(track, { clientX: 155, clientY: 12, button: 0 });
    expect(onChange).toHaveBeenCalledWith(2, 3);
  });

  it('commits on release', () => {
    const { track, onCommit } = renderRate({ value: 1 });
    fireEvent.pointerDown(track, { clientX: 155, clientY: 12, button: 0 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(document, { clientX: 155, clientY: 12 });
    expect(onCommit).toHaveBeenCalledWith(2, 3);
  });

  it('does not commit a press that chose nothing', () => {
    const { track, onChange, onCommit } = renderRate({ value: 1 });
    // Dead centre is the detent the thumb already sits on.
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 12 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reports each detent a drag crosses exactly once', () => {
    const { thumb, onChange } = renderRate({ value: 1 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 152, clientY: 12 });
    fireEvent.pointerMove(document, { clientX: 158, clientY: 12 });
    fireEvent.pointerMove(document, { clientX: 196, clientY: 12 });
    expect(onChange.mock.calls).toEqual([
      [2, 3],
      [4, 4],
    ]);
  });
});

describe('DetentSlider value resolution', () => {
  it('shows the nearest detent for a number that is not one of them', () => {
    const { thumb } = renderRate({ value: 1.6 });
    expect(thumb.getAttribute('aria-valuenow')).toBe('3');
  });

  it('does not emit while resolving a stray value', () => {
    const { onChange, onCommit } = renderRate({ value: 1.6 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('falls back to the first detent when the values are not numeric', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DetentSlider items={['low', 'mid', 'high']} value={'gone' as 'low'} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
    expect(thumb.getAttribute('aria-valuetext')).toBe('low');
  });
});

describe('DetentSlider degenerate input', () => {
  it('renders nothing rather than crashing on an empty list', () => {
    const { container } = render(<DetentSlider items={[]} value={1} onChange={() => {}} />);
    expect(container.querySelector('[role="slider"]')).toBeNull();
    expect(ticks(container)).toHaveLength(0);
  });
});
