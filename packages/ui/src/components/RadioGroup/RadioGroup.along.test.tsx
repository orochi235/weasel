import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { Along, arcInBox, type AlongArc } from '../Along';
import { Radio, RadioGroup } from './RadioGroup';
import alongStyles from '../Along/Along.module.css';

// jsdom lays nothing out: an Along is 200 by 200, every other element 40 wide and 20 tall, every box at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realOffset = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!] as const);
const isAlong = (el: HTMLElement) => el.classList.contains(alongStyles.along!);
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 40; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 20; } });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  for (const [k, d] of realOffset) Object.defineProperty(HTMLElement.prototype, k, d);
});
afterEach(cleanup);

const TOP: AlongArc = { start: 270, end: 90 };
const BOTTOM: AlongArc = { start: 270, end: 90, direction: 'ccw' };
const runOf = (arc: AlongArc) => trackRun(arcShape(arcInBox(arc, { width: 200, height: 200 })));
const CENTER = { x: 100, y: 100 };

function Sample({ arc, onChange }: { arc?: AlongArc; onChange?: (v: string) => void }) {
  const group = (
    <RadioGroup label="Color" description="Pick one" onChange={onChange}>
      <Radio value="r">Red</Radio>
      <Radio value="g">Green</Radio>
      <Radio value="b">Blue</Radio>
    </RadioGroup>
  );
  return arc ? <Along arc={arc}>{group}</Along> : group;
}

const at = (el: Element): Point => {
  const style = (el as HTMLElement).style;
  return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')) };
};
const labelOf = (text: string) => screen.getByText(text).closest('label')!;
const hint = () => document.querySelector('[data-radio-hint]') as HTMLElement;
const fromCenter = (p: Point) => Math.hypot(p.x - CENTER.x, p.y - CENTER.y);

describe('RadioGroup along a curve', () => {
  test('lays the label first and the radios after it, along the run', () => {
    render(<Sample arc={TOP} />);
    const run = runOf(TOP);
    const parts = [screen.getByText('Color'), labelOf('Red'), labelOf('Green'), labelOf('Blue')];
    const ds = parts.map((el) => run.nearest(at(el)).f * run.length);
    for (let i = 1; i < ds.length; i++) expect(ds[i]! - ds[i - 1]!).toBeCloseTo(40, 0);
    for (const el of parts) expect(run.nearest(at(el)).dist).toBeCloseTo(0, 3);
  });

  test('the description sits one row in from the run, on the inside of the bend, on a top arc and a bottom arc', () => {
    for (const arc of [TOP, BOTTOM]) {
      const { unmount } = render(<Sample arc={arc} />);
      const radius = fromCenter(at(labelOf('Green')));
      // Half a row, 20 tall, in from the run: the block hangs on in from there.
      expect(fromCenter(at(hint()))).toBeCloseTo(radius - 10, 1);
      expect(hint().style.getPropertyValue('--hang')).toBe(arc === TOP ? '1' : '-1');
      expect(screen.getByText('Pick one')).toBeInTheDocument();
      unmount();
    }
  });

  test('choosing works on the arc: a click, and the arrow keys in reading order', () => {
    const onChange = vi.fn();
    render(<Sample arc={TOP} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Green'));
    expect(onChange).toHaveBeenLastCalledWith('g');
    act(() => (screen.getByLabelText('Green') as HTMLInputElement).focus());
    fireEvent.keyDown(screen.getByLabelText('Green'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('Color');
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription('Pick one');
  });

  test('outside an Along it renders as it always has', () => {
    render(<Sample />);
    expect(labelOf('Red').style.getPropertyValue('--at-x')).toBe('');
    expect(labelOf('Red')).not.toHaveAttribute('data-run-slot');
    expect(hint()).toBeNull();
  });
});
