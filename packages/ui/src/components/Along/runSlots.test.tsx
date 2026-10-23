import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createContext, useMemo, useRef, type ReactNode } from 'react';
import { arcShape, lineShape, trackRun } from '@weasel-js/geom';
import { bendAt, insideOf } from './runBend';
import { createRunSlots, RUN_HOST, useRunSlot, useRunSlotHost, type RunSlots } from './runSlots';

const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 20 });
});
afterAll(() => Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffset));
afterEach(cleanup);

const run = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }));
const ChipSlots = createContext<RunSlots | null>(null);
const OtherSlots = createContext<RunSlots | null>(null);

/** A host that renders none of its chips: they come in as children and find their places by key. */
function Row({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => createRunSlots(), []);
  useRunSlotHost({ slots, root, run, gap: 10, align: 'start' });
  return (
    <div ref={root} {...{ [RUN_HOST]: '' }}>
      <ChipSlots.Provider value={slots}>{children}</ChipSlots.Provider>
    </div>
  );
}

function Chip({ id, family = ChipSlots }: { id: string; family?: typeof ChipSlots }) {
  const slot = useRunSlot(family, id);
  return <span data-testid={id} {...slot}>{id}</span>;
}

const x = (id: string) => screen.getByTestId(id).style.getPropertyValue('--at-x');

describe('run slots', () => {
  test('parts the host does not render take their places by key, in document order, however deep', () => {
    render(
      <Row>
        <Chip id="a" />
        <div><Chip id="b" /></div>
        <Chip id="c" />
      </Row>,
    );
    expect(['a', 'b', 'c'].map(x)).toEqual(['10px', '40px', '70px']);
  });

  test('a part that moves in the document moves on the run', () => {
    const { rerender } = render(<Row><Chip key="a" id="a" /><Chip key="b" id="b" /></Row>);
    rerender(<Row><Chip key="b" id="b" /><Chip key="a" id="a" /></Row>);
    expect([x('b'), x('a')]).toEqual(['10px', '40px']);
  });

  test("a part of another family, or outside any host, draws as it would off a run", () => {
    render(
      <>
        <Row><Chip id="a" /><Chip id="z" family={OtherSlots} /></Row>
        <Chip id="out" />
      </>,
    );
    expect(x('z')).toBe('');
    expect(screen.getByTestId('z')).not.toHaveAttribute('data-run-slot');
    expect(screen.getByTestId('out')).not.toHaveAttribute('data-run-slot');
    expect(x('a')).toBe('10px');
  });
});

describe('bendAt and insideOf', () => {
  const top = trackRun(arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 }));
  const bottom = trackRun(arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 240, end: 120, direction: 'ccw' }));
  test('a top arc bends away from its items, which face the inside with their bottoms', () => {
    expect(bendAt(top, 0.5)).toBe(-1);
    expect(insideOf(top, 0.5)).toBe('bottom');
  });
  test('a bottom arc bends toward its items, which face the inside with their tops', () => {
    expect(bottom.flipped).toBe(true);
    expect(bendAt(bottom, 0.5)).toBe(1);
    expect(insideOf(bottom, 0.5)).toBe('top');
  });
  test('a line does not bend', () => {
    expect(bendAt(run, 0.5)).toBe(0);
    expect(insideOf(run, 0.5)).toBe('bottom');
  });
});
