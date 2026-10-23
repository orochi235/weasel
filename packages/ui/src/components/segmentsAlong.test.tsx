import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { arcShape, trackRun } from '@weasel-js/geom';
import { Along } from './Along';
import alongStyles from './Along/Along.module.css';
import { ButtonBar } from './ButtonBar';
import { OptionsBar } from './OptionsBar';
import { ToggleBar } from './ToggleBar';
import seg from './segmentedControl.module.css';

// jsdom lays nothing out: every segment is 40 wide and every box 200 by 200 at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains(alongStyles.along!) ? 200 : 40; } });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realWidth);
});
afterEach(cleanup);

const shape = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 });
const run = trackRun(shape);
const ITEMS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

const at = (el: Element) => {
  const style = (el as HTMLElement).style;
  return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')) };
};

function Toggle({ initial = 'b', variant }: { initial?: string; variant?: 'flat' | 'minimal' }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Along shape={shape}>
      <ToggleBar ariaLabel="Pick" items={ITEMS} value={value} onChange={setValue} variant={variant} />
    </Along>
  );
}

describe('segmented controls along a curve', () => {
  test('lay their segments edge to edge along the run, centered on it', () => {
    render(<Toggle />);
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio, i) => {
      const want = run.at((run.length / 2 + (i - 1) * 40) / run.length).point;
      expect(at(radio).x).toBeCloseTo(want.x);
      expect(at(radio).y).toBeCloseTo(want.y);
    });
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-shape', 'arc');
  });

  test('stroke the well along the run and the lit segment as a stretch of it, not as a box', () => {
    render(<Toggle />);
    const group = screen.getByRole('radiogroup');
    const lit = group.querySelectorAll('[data-lit]');
    expect(lit).toHaveLength(1);
    expect(lit[0]).toHaveAttribute('data-lit', 'on');
    expect(lit[0]!.getAttribute('d')).toMatch(/^M .* A /);
    const selected = screen.getByRole('radio', { checked: true });
    expect(selected).toHaveAttribute('data-state', 'on');
    expect(selected.className).not.toContain(seg.segmentSelected);
  });

  test('a mixed segment is stroked as mixed', () => {
    render(
      <Along shape={shape}>
        <ToggleBar mode="multiple" ariaLabel="Style" items={ITEMS} value={['a']} mixedValues={['c']} onChange={() => {}} />
      </Along>,
    );
    const lit = [...screen.getByRole('group').querySelectorAll('[data-lit]')].map((el) => el.getAttribute('data-lit'));
    expect(lit).toEqual(['on', 'mixed']);
  });

  test('the arrow keys still move the selection in reading order', () => {
    render(<Toggle />);
    const b = screen.getByRole('radio', { name: 'B' });
    b.focus();
    fireEvent.keyDown(b, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radiogroup').querySelector('[data-lit]')!.getAttribute('d')).not.toBe('');
  });

  test.each(['flat', 'minimal'] as const)("the %s variant draws no well and keeps each segment's own box", (variant) => {
    render(<Toggle variant={variant} />);
    expect(screen.getByRole('radiogroup').querySelector('svg [data-lit]')).toBeNull();
    expect(screen.getByRole('radio', { checked: true }).className).toContain(seg.segmentSelected);
  });

  test('ButtonBar and OptionsBar follow the run too', () => {
    render(
      <Along shape={shape}>
        <ButtonBar ariaLabel="Do" items={[{ value: 'x', label: 'X', onAction: () => {} }]} />
        <OptionsBar ariaLabel="Opts" items={[{ value: 'y', label: 'Y', selected: true, onChange: () => {} }]} />
      </Along>,
    );
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-shape', 'arc');
    expect(screen.getByRole('group')).toHaveAttribute('data-shape', 'arc');
    expect(screen.getByRole('group').querySelectorAll('[data-lit="on"]')).toHaveLength(1);
    expect(at(screen.getByRole('button', { name: 'X' })).x).toBeCloseTo(run.at(0.5).point.x);
  });

  test('outside an Along a bar keeps its straight well', () => {
    render(<ToggleBar ariaLabel="Pick" items={ITEMS} value="b" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('data-shape');
    expect(screen.getByRole('radio', { checked: true }).className).toContain(seg.segmentSelected);
    expect(screen.getByRole('radio', { checked: true })).not.toHaveAttribute('data-segment');
  });
});
