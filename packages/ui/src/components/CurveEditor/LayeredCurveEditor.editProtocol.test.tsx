import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { keyframeLayerState, type KeyframeLayerState } from './createKeyframeLayer';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { KeyframeLayer } from './KeyframeLayer';
import { FunctionLayer } from './FunctionLayer';
import { functionLayerState } from './createFunctionLayer';
import { CurveEditor } from './CurveEditor';

// The edit protocol, docs/conventions.md "Edit callbacks", as the curve editors keep it.
// Plot is 200×100 over t 0..1000, value 0..10: x = t / 5, y = 100 - value * 10.
const KEYS = [{ t: 0, value: 0 }, { t: 500, value: 10 }, { t: 1000, value: 5 }];
const STATE = keyframeLayerState(KEYS);

const svg = (): SVGSVGElement => document.querySelector('svg')!;
const key = (i: number) => document.querySelector(`[data-keyframe-index="${i}"]`)!;
const down = (x: number, y: number) => fireEvent.pointerDown(svg(), { clientX: x, clientY: y, button: 0, pointerId: 1 });
const move = (x: number, y: number) => fireEvent.pointerMove(document, { clientX: x, clientY: y, pointerId: 1 });
const up = (x: number, y: number) => fireEvent.pointerUp(document, { clientX: x, clientY: y, pointerId: 1 });

function editor(layer: React.ReactNode) {
  return <LayeredCurveEditor width={200} height={100} xRange={[0, 1000]} yRange={[0, 10]} history={false}>{layer}</LayeredCurveEditor>;
}

describe('curve layers and the edit protocol', () => {
  it('a commit-only layer draws its drag and commits it once, with the state it began from', () => {
    const onChange = vi.fn();
    render(editor(<KeyframeLayer label="x" state={STATE} onChange={onChange} />));
    down(100, 0);
    move(120, 10);
    move(140, 20);
    expect(document.querySelector('[data-keyframe-ghost]')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    up(140, 20);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, prev] = onChange.mock.calls[0] as [KeyframeLayerState, KeyframeLayerState];
    expect(next.keys[1].t).toBe(700);
    expect(prev).toBe(STATE);
    expect(document.querySelector('[data-keyframe-ghost]')).toBeNull();
  });

  it('a press that changes nothing commits nothing', () => {
    const onChange = vi.fn();
    // Key 1 already selected, so pressing it selects nothing new.
    render(editor(<KeyframeLayer label="x" state={{ ...STATE, selectedKey: 1 }} onChange={onChange} />));
    down(100, 0);
    up(100, 0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a drag that moves no point commits nothing', () => {
    const onChange = vi.fn();
    // A pinned endpoint holds still however far it is dragged; the anchor at t 0, value 0 sits at plot (0, 100).
    const state = functionLayerState([{ x: 0, y: 0 }, { x: 1000, y: 10 }]);
    render(editor(<FunctionLayer endpoints="pinned-both" state={state} onChange={onChange} />));
    down(0, 100);
    move(60, 40);
    up(60, 40);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a key step is one edit, previewed and committed once', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(editor(<KeyframeLayer label="x" step={{ x: 10 }} state={STATE} onInput={onInput} onChange={onChange} />));
    fireEvent.keyDown(key(1), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as KeyframeLayerState).keys[1].t).toBe(510);
    expect((onInput.mock.calls.at(-1)![0] as KeyframeLayerState).keys[1].t).toBe(510);
  });

  it('Escape cancels a drag: the preview goes back, onCancel fires, nothing commits', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(editor(<KeyframeLayer label="x" state={STATE} onInput={onInput} onChange={onChange} onCancel={onCancel} />));
    down(100, 0);
    move(140, 20);
    fireEvent.keyDown(svg(), { key: 'Escape' });
    const restored = onInput.mock.calls.at(-1)![0] as KeyframeLayerState;
    expect(restored.keys).toEqual(KEYS);
    expect(restored.drag).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    up(140, 20);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws what the consumer normalized a preview to', () => {
    function Clamped() {
      const [state, setState] = useState(STATE);
      // The consumer keeps the dragged key at or before 600 ms.
      const clamp = (s: KeyframeLayerState): KeyframeLayerState =>
        (s.drag?.kind === 'key' && s.drag.t > 600 ? { ...s, drag: { ...s.drag, t: 600 } } : s);
      return <KeyframeLayer label="x" state={state} onInput={(s) => setState(clamp(s))} onChange={(s) => setState(clamp(s))} />;
    }
    render(editor(<Clamped />));
    down(100, 0);
    move(180, 0);
    const ghost = document.querySelector('[data-keyframe-ghost]')!;
    const [, cx] = /rotate\(45 ([\d.]+)/.exec(ghost.getAttribute('transform')!)!;
    expect(Number(cx)).toBeCloseTo(120);
    up(180, 0);
  });
});

describe('CurveEditor and the edit protocol', () => {
  const POINTS = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
  const middle = () => document.querySelectorAll('[data-anchor-index]')[1] as Element;

  it('a commit-only editor draws the drag and commits once at the release', () => {
    const onChange = vi.fn();
    render(<CurveEditor value={POINTS} onChange={onChange} width={200} height={100} />);
    const before = middle().getAttribute('cy');
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 40, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 30, pointerId: 1, buttons: 1 });
    expect(middle().getAttribute('cy')).not.toBe(before);
    fireEvent.pointerUp(document, { clientX: 100, clientY: 30, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][1]).toBe(POINTS);
    expect(onChange.mock.calls[0][0][1].y).toBeCloseTo(0.7);
  });

  it('Escape cancels a drag and reports it', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(<CurveEditor value={POINTS} onInput={onInput} onChange={onChange} onCancel={onCancel} width={200} height={100} />);
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onInput.mock.calls.at(-1)![0]).toEqual(POINTS);
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(document, { clientX: 120, clientY: 30, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
