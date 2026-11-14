import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describeHold } from '../Disabled/testing/holdCases.fixtures';
import { CurveEditor, type ControlPoint } from './CurveEditor';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { FunctionLayer } from './FunctionLayer';
import { functionLayerState } from './createFunctionLayer';

const POINTS = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
const svg = () => document.querySelector<SVGSVGElement>('svg')! as unknown as HTMLElement;
const anchors = () => [...document.querySelectorAll<HTMLElement>('[data-anchor-index][tabindex]')];

// Its anchors are a layer's marks, which the plot's own `aria-disabled` covers, so only the plot says the reason.
describeHold('CurveEditor', (mount, own) => {
  const onInput = vi.fn();
  const onChange = vi.fn();
  mount(<CurveEditor value={POINTS} onInput={onInput} onChange={onChange} width={200} height={100} aria-label="Falloff" {...own} />);
  return {
    targets: () => [svg(), ...anchors()],
    described: () => [svg()],
    tryAll: () => {
      const middle = document.querySelectorAll('[data-anchor-index]')[1]!;
      fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
      fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1 });
      fireEvent.pointerUp(document, { clientX: 120, clientY: 30, pointerId: 1 });
      fireEvent.keyDown(document.querySelectorAll('[data-anchor-index]')[1]!, { key: 'ArrowUp' });
      fireEvent.contextMenu(document.querySelectorAll('[data-anchor-index]')[1]!, { clientX: 120, clientY: 30 });
      fireEvent.pointerDown(svg(), { clientX: 60, clientY: 20, pointerId: 2 });
      fireEvent.pointerUp(document, { clientX: 60, clientY: 20, pointerId: 2 });
    },
    changed: () => onInput.mock.calls.length + onChange.mock.calls.length > 0,
  };
}, { ariaHeld: false });

// Its layers are children now, under the plot's hold all the same.
describeHold('LayeredCurveEditor', (mount, own) => {
  const onChange = vi.fn();
  mount(
    <LayeredCurveEditor width={200} height={100} aria-label="Falloff" {...own}>
      <FunctionLayer state={functionLayerState(POINTS)} onChange={onChange} onCommit={onChange} />
    </LayeredCurveEditor>,
  );
  return {
    targets: () => [svg(), ...anchors()],
    described: () => [svg()],
    tryAll: () => {
      const middle = document.querySelectorAll('[data-anchor-index]')[1]!;
      fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
      fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1 });
      fireEvent.pointerUp(document, { clientX: 120, clientY: 30, pointerId: 1 });
      fireEvent.keyDown(document.querySelectorAll('[data-anchor-index]')[1]!, { key: 'ArrowUp' });
      fireEvent.contextMenu(document.querySelectorAll('[data-anchor-index]')[1]!, { clientX: 120, clientY: 30 });
      fireEvent.pointerDown(svg(), { clientX: 60, clientY: 20, pointerId: 2 });
      fireEvent.pointerUp(document, { clientX: 60, clientY: 20, pointerId: 2 });
    },
    changed: () => onChange.mock.calls.length > 0,
  };
}, { ariaHeld: false });

it('marks the held plot for assistive technology and the stylesheet, and takes it out of reach with no reason', () => {
  const { rerender } = render(<CurveEditor value={POINTS} onInput={() => {}} width={200} height={100} disabled disabledReason="Locked" />);
  expect(svg()).toHaveAttribute('aria-disabled', 'true');
  expect(svg()).toHaveAttribute('data-held', 'disabled');
  expect(svg()).not.toHaveAttribute('inert');
  rerender(<CurveEditor value={POINTS} onInput={() => {}} width={200} height={100} disabled />);
  expect(svg()).toHaveAttribute('inert');
  rerender(<CurveEditor value={POINTS} onInput={() => {}} width={200} height={100} readOnly />);
  expect(svg()).toHaveAttribute('data-held', 'readOnly');
  expect(svg()).not.toHaveAttribute('aria-disabled');
});

function Kept({ readOnly, onInput }: { readOnly: boolean; onInput: (next: ControlPoint[]) => void }) {
  const [value, setValue] = useState<ControlPoint[]>(POINTS);
  return <CurveEditor value={value} onInput={(next) => { onInput(next); setValue(next); }} width={200} height={100} readOnly={readOnly} />;
}

it('holds undo and redo', () => {
  const onInput = vi.fn();
  const { container, rerender } = render(<Kept readOnly={false} onInput={onInput} />);
  fireEvent.keyDown(container.querySelectorAll('[data-anchor-index]')[1]!, { key: 'ArrowUp' });
  const steps = onInput.mock.calls.length;
  expect(steps).toBeGreaterThan(0);
  rerender(<Kept readOnly onInput={onInput} />);
  fireEvent.keyDown(svg(), { key: 'z', ctrlKey: true });
  expect(onInput.mock.calls.length).toBe(steps);
  rerender(<Kept readOnly={false} onInput={onInput} />);
  fireEvent.keyDown(svg(), { key: 'z', ctrlKey: true });
  expect(onInput.mock.calls.length).toBe(steps + 1);
});
