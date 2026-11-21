import { describe, expect, it, vi } from 'vitest';
import { useRef, useState, type ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { FunctionLayer } from './FunctionLayer';
import { functionLayerState, type FunctionLayerState } from './createFunctionLayer';

function Controlled(): ReactElement {
  const [value, setValue] = useState<ControlPoint[]>([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
  return <CurveEditor value={value} onInput={setValue} width={200} height={100} />;
}

const middle = (): Element => document.querySelectorAll('[data-anchor-index]')[1];

describe('CurveEditor — built-in undo', () => {
  it('does not spend an undo step on a click that moved nothing', () => {
    const { container } = render(<Controlled />);
    fireEvent.keyDown(middle(), { key: 'ArrowUp', shiftKey: true });
    const nudged = middle().getAttribute('cy');
    expect(nudged).not.toBe('50');
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: Number(nudged), pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: Number(nudged), pointerId: 1 });
    fireEvent.keyDown(container.querySelector('svg')!, { key: 'z', ctrlKey: true });
    expect(middle().getAttribute('cy')).toBe('50');
  });

  it('ignores undo and the arrow keys while a drag is in flight', () => {
    const { container } = render(<Controlled />);
    const svg = container.querySelector('svg')!;
    fireEvent.keyDown(middle(), { key: 'ArrowUp' });
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: Number(middle().getAttribute('cy')), pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 20, pointerId: 1, buttons: 1 });
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(middle(), { key: 'ArrowDown' });
    expect(Number(middle().getAttribute('cy'))).toBeCloseTo(20);
    fireEvent.pointerUp(document, { clientX: 100, clientY: 20, pointerId: 1 });
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(Number(middle().getAttribute('cy'))).toBeLessThan(50);
    expect(Number(middle().getAttribute('cy'))).toBeGreaterThan(20);
  });

  it('keeps the last 100 steps and drops older ones', () => {
    const { container } = render(<Controlled />);
    const cy = (): number => Number(middle().getAttribute('cy'));
    // 101 edits, ending one nudge above where the point began.
    for (let i = 0; i < 101; i++) fireEvent.keyDown(middle(), { key: i % 2 === 0 ? 'ArrowUp' : 'ArrowDown' });
    const nudged = cy();
    expect(nudged).not.toBeCloseTo(50);
    const svg = container.querySelector('svg')!;
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(cy()).toBeCloseTo(50);
    // The oldest step is gone, so undoing everything stops one edit short of the start.
    for (let i = 0; i < 150; i++) fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(cy()).toBeCloseTo(nudged);
  });

  it('reports an undo and a redo through onChange, as the end of a drag is', () => {
    const onChange = vi.fn();
    function Host(): ReactElement {
      const [value, setValue] = useState<ControlPoint[]>([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
      return <CurveEditor value={value} onInput={setValue} onChange={onChange} width={200} height={100} />;
    }
    const { container } = render(<Host />);
    fireEvent.keyDown(middle(), { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [nudged, start] = onChange.mock.calls[0];

    const svg = container.querySelector('svg')!;
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]).toEqual([start, nudged]);

    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls[2]).toEqual([nudged, start]);
  });

  it('redoes the undone steps in order, and a new edit drops what is left to redo', () => {
    const { container } = render(<Controlled />);
    const cy = (): string | null => middle().getAttribute('cy');
    const svg = container.querySelector('svg')!;
    const seen = [cy()];
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(middle(), { key: 'ArrowUp', shiftKey: true });
      seen.push(cy());
    }
    for (let i = 0; i < 3; i++) fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(cy()).toBe(seen[0]);
    fireEvent.keyDown(svg, { key: 'y', ctrlKey: true });
    expect(cy()).toBe(seen[1]);
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(cy()).toBe(seen[2]);

    fireEvent.keyDown(middle(), { key: 'ArrowDown', shiftKey: true });
    const forked = cy();
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(cy()).toBe(forked);
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(cy()).toBe(seen[2]);
  });

  describe('a right-click delete', () => {
    const FOUR: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, { x: 1, y: 1 }];
    function Four(props: { onChange?: (next: ControlPoint[], prev: readonly ControlPoint[]) => void; minPoints?: number }): ReactElement {
      const [value, setValue] = useState<ControlPoint[]>(FOUR);
      return (
        <CurveEditor
          value={value}
          onInput={setValue}
          onChange={props.onChange}
          minPoints={props.minPoints}
          endpoints="pinned-x"
          width={200}
          height={100}
        />
      );
    }
    const anchors = (): Element[] => [...document.querySelectorAll('[data-anchor-index]')];
    // jsdom lays nothing out, so client coordinates are plot coordinates.
    const rightClick = (el: Element, x: number, y: number): boolean =>
      fireEvent.contextMenu(el, { clientX: x, clientY: y });

    it('is one undo step of its own', () => {
      const { container } = render(<Four />);
      fireEvent.keyDown(anchors()[1], { key: 'ArrowUp', shiftKey: true });
      const nudged = anchors()[1].getAttribute('cy');
      expect(rightClick(anchors()[2], 150, 50)).toBe(false);
      expect(anchors()).toHaveLength(3);

      fireEvent.keyDown(container.querySelector('svg')!, { key: 'z', ctrlKey: true });
      expect(anchors()).toHaveLength(4);
      expect(anchors()[1].getAttribute('cy')).toBe(nudged);
    });

    it('can be undone when it was the first edit', () => {
      const onChange = vi.fn();
      const { container } = render(<Four onChange={onChange} />);
      rightClick(anchors()[2], 150, 50);
      expect(anchors()).toHaveLength(3);
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(container.querySelector('svg')!, { key: 'z', ctrlKey: true });
      expect(anchors()).toHaveLength(4);
    });

    it('leaves a pinned endpoint and a curve at its minimum alone', () => {
      const { unmount } = render(<Four />);
      rightClick(anchors()[0], 0, 100);
      expect(anchors()).toHaveLength(4);
      unmount();

      render(<Four minPoints={4} />);
      rightClick(anchors()[2], 150, 50);
      expect(anchors()).toHaveLength(4);
    });

    it('leaves the browser menu alone away from an anchor', () => {
      const { container } = render(<Four />);
      expect(rightClick(container.querySelector('svg')!, 100, 5)).toBe(true);
      expect(anchors()).toHaveLength(4);
    });
  });
});

describe('LayeredCurveEditor — built-in undo', () => {
  const POINTS: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
  const anchorOf = (id: string): Element => document.querySelector(`[data-layer-id="${id}"] [data-anchor-index="1"]`)!;
  const undo = (): void => { fireEvent.keyDown(document.querySelector('svg')!, { key: 'z', ctrlKey: true }); };

  it('reports no edit to a layer whose state an undo leaves equal, though rebuilt each render', () => {
    const onOther = vi.fn();
    function Host(): ReactElement {
      const [s, setS] = useState(functionLayerState(POINTS));
      return (
        <LayeredCurveEditor width={200} height={100}>
          <FunctionLayer id="other" state={functionLayerState([{ x: 0, y: 1 }, { x: 1, y: 0 }])} onInput={onOther} onChange={onOther} />
          <FunctionLayer id="edited" state={s} onInput={setS} />
        </LayeredCurveEditor>
      );
    }
    render(<Host />);
    fireEvent.keyDown(anchorOf('edited'), { key: 'ArrowUp' });
    undo();
    expect(anchorOf('edited').getAttribute('cy')).toBe('50');
    expect(onOther).not.toHaveBeenCalled();
  });

  it('skips a step a declined edit left, so an undo reaches the last edit that landed', () => {
    let accept = true;
    function Host(): ReactElement {
      const [s, setS] = useState(functionLayerState(POINTS));
      const take = useRef((n: FunctionLayerState) => { if (accept) setS(n); }).current;
      return (
        <LayeredCurveEditor width={200} height={100}>
          <FunctionLayer id="edited" state={s} onInput={take} onChange={take} />
        </LayeredCurveEditor>
      );
    }
    render(<Host />);
    fireEvent.keyDown(anchorOf('edited'), { key: 'ArrowUp' });
    const nudged = anchorOf('edited').getAttribute('cy');
    expect(nudged).not.toBe('50');
    accept = false;
    fireEvent.keyDown(anchorOf('edited'), { key: 'ArrowUp' });
    expect(anchorOf('edited').getAttribute('cy')).toBe(nudged);
    accept = true;
    undo();
    expect(anchorOf('edited').getAttribute('cy')).toBe('50');
  });
});
