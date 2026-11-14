import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { linearScale } from '@weasel-js/plot/scales';
import * as ui from '../../index';
import { Ruler, RulerMark } from './Ruler';

const WIDTH = 500;
const LABEL_W = 30;
const original = Element.prototype.getBoundingClientRect;

// A label sits LABEL_W wide at its tick's place; the ruler is WIDTH wide.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
    const at = (this.parentElement as HTMLElement | null)?.style.left;
    const left = at?.endsWith('%') ? (parseFloat(at) / 100) * WIDTH : 0;
    const width = at?.endsWith('%') ? LABEL_W : WIDTH;
    return { x: left, y: 0, top: 0, left, right: left + width, bottom: 20, width, height: 20, toJSON: () => {} } as DOMRect;
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = original;
});

const scale = linearScale({ domain: [0, 100], range: [0, 1] });
const ticksOf = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-tick-at]')];

describe('Ruler', () => {
  it('places each given tick at its share of the scale', () => {
    const { container } = render(<Ruler scale={scale} ticks={[{ at: 25, label: 'a' }, { at: 80 }]} />);
    const ticks = ticksOf(container);
    expect(ticks.map((t) => t.style.left)).toEqual(['25%', '80%']);
    expect(ticks.map((t) => t.textContent)).toEqual(['a', '']);
  });

  it('spaces its own ticks by the room between them, and labels them plainly', () => {
    const { container } = render(<Ruler scale={scale} ticks={{ minSpacing: 50 }} />);
    expect(ticksOf(container).map((t) => t.textContent)).toEqual(['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100']);
  });

  it('labels spaced ticks through `format`, which is told the step', () => {
    const format = vi.fn((v: number, { step }: { step: number }) => `${v}/${step}`);
    const { container } = render(<Ruler scale={scale} ticks={{ minSpacing: 100, format }} />);
    expect(ticksOf(container)[1]!.textContent).toBe('20/20');
  });

  it('hides the less round of two crowded labels and keeps its notch', () => {
    const { container } = render(<Ruler scale={scale} ticks={[{ at: 40, label: '40' }, { at: 44, label: '44' }, { at: 50, label: '50' }]} />);
    const crowded = ticksOf(container).map((t) => t.firstElementChild!.hasAttribute('data-crowded'));
    expect(crowded).toEqual([false, true, false]);
  });

  it('gives way first at a higher level', () => {
    const { container } = render(<Ruler scale={scale} ticks={[{ at: 50, label: '50', level: 1 }, { at: 53, label: '53' }]} />);
    const crowded = ticksOf(container).map((t) => t.firstElementChild!.hasAttribute('data-crowded'));
    expect(crowded).toEqual([true, false]);
  });

  it('always shows a mark’s label, and hides tick labels that crowd it', () => {
    const { container } = render(
      <Ruler scale={scale} ticks={[{ at: 0, label: '0' }, { at: 50, label: '50' }]}>
        <RulerMark at={2} label="lo" side="start" />
      </Ruler>,
    );
    const mark = container.querySelector<HTMLElement>('[data-ruler-mark]')!;
    expect(mark.style.left).toBe('2%');
    expect(mark.firstElementChild!.hasAttribute('data-crowded')).toBe(false);
    expect(ticksOf(container).map((t) => t.firstElementChild!.hasAttribute('data-crowded'))).toEqual([true, false]);
  });

  it('passes a mark’s own attributes through', () => {
    const { getByTestId } = render(<Ruler scale={scale}><RulerMark at={30} cursor data-testid="head" /></Ruler>);
    expect(getByTestId('head').style.left).toBe('30%');
  });

  it('refuses a mark outside a ruler', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<RulerMark at={0} />)).toThrow(/child of a Ruler/);
    vi.restoreAllMocks();
  });

  it('is exported from the package entry', () => {
    expect(ui.Ruler).toBe(Ruler);
    expect(ui.RulerMark).toBe(RulerMark);
  });
});
