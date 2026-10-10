import '@weasel-js/theme/tokens.css';
import { act, cleanup, render } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefDrop, PrefDropMark } from './drop';
import { prefDropTargetAt } from './dropTarget';
import { PrefsForm } from './PrefsForm';

// Where a drag lands is read off the form's layout, and drawing the answer moves that layout. Only real layout
// shows whether the two agree.

// The form under test is wider than the runner's default page, and a point off the page is over nothing.
beforeAll(() => page.viewport(900, 600));
afterEach(cleanup);

const leaf = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const NEW = leaf('Dropped');
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        a: leaf('Alpha'),
        b: leaf('Beta'),
        c: leaf('Gamma'),
        margin: { kind: 'object', name: 'Margin', description: '', default: { x: 1 }, children: { x: { kind: 'number', name: 'X', description: '', default: 1 } } },
        d: leaf('Delta'),
        e: leaf('Epsilon'),
        snapping: { name: 'Snapping', children: { f: leaf('Phi'), g: leaf('Chi'), h: leaf('Psi') } },
      },
    },
    io: { name: 'Import', children: { author: leaf('Author'), license: leaf('License') } },
  },
};

interface Harness {
  box: HTMLElement;
  /** Point the drag at a client point: what the form says is there, drawn. */
  aim(x: number, y: number): PrefDropMark | null;
  select(path: string): void;
}

function mount(across: 1 | 2, from?: string, height = 420): Harness {
  let setDrop!: (d: PrefDrop | null) => void;
  let setSelected!: (p: string) => void;
  const node = from === undefined ? NEW : (SCHEMA.children.canvas as PrefGroup).children[from.split('.')[1]!]!;
  function Host() {
    const [drop, set] = useState<PrefDrop | null>(null);
    const [selected, pick] = useState<string | undefined>(undefined);
    setDrop = set;
    setSelected = pick;
    return (
      <div style={{ width: 720, height, display: 'flex' }}>
        <PrefsForm layout="rail" rowsAcross={across} schema={SCHEMA} values={{}} onChange={() => {}} drop={drop} selected={selected} />
      </div>
    );
  }
  const { container } = render(<Host />);
  const box = container.firstElementChild as HTMLElement;
  return {
    box,
    aim(x, y) {
      const mark = prefDropTargetAt(box, x, y);
      act(() => setDrop(mark && { ...mark, nodes: [node], ...(from === undefined ? {} : { from: [from] }) }));
      return mark;
    },
    select: (path) => act(() => setSelected(path)),
  };
}

const rowAt = (box: HTMLElement, path: string): HTMLElement => box.querySelector(`[data-pref-path="${path}"]`)!;
const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
};
const placeholder = (box: HTMLElement) => box.querySelector('[data-drop-placeholder]');

describe.each([1, 2] as const)('a drop drawn at %i across', (across) => {
  it('opens a gap at the row under the pointer and draws the node in it', () => {
    const h = mount(across);
    const before = center(rowAt(h.box, 'canvas.b'));
    // The near quarter of the row, on whichever axis its rows run.
    const x = across === 2 ? before.r.left + before.r.width / 4 : before.x;
    const y = across === 2 ? before.y : before.r.top + before.r.height / 4;
    expect(h.aim(x, y)).toEqual({ path: 'canvas.b', where: 'before' });
    const gap = placeholder(h.box)!.getBoundingClientRect();
    // To within a scrollbar: the line the gap adds can be the one that makes the pane scroll.
    expect(Math.abs(gap.left - before.r.left)).toBeLessThan(16);
    expect(gap.top).toBeCloseTo(before.r.top, 0);
    expect(placeholder(h.box)!.textContent).toContain('Dropped');
    const after = rowAt(h.box, 'canvas.b').getBoundingClientRect();
    // The row it displaced is the next one along: beside the gap, or at the start of the line below.
    expect(after.left > before.r.left + 16 || after.top > before.r.top).toBe(true);
  });

  it.each([['a node new to the form', undefined], ['a row of the form', 'canvas.c'], ['a row that spans the pane', 'canvas.margin']])(
    'gives a pointer held still one answer, however the form has moved under it: %s', (_, from) => {
      const h = mount(across, from);
      const pane = h.box.querySelector('[data-pref-into]')!.getBoundingClientRect();
      let moved = 0;
      // A sweep, so each point is asked with the previous point's drop still drawn.
      for (let y = pane.top + 2; y < pane.bottom; y += 9) {
        for (let x = pane.left + 2; x < pane.right; x += 13) {
          const first = h.aim(x, y);
          const second = h.aim(x, y);
          expect(second, `at ${x},${y}`).toEqual(first);
          if (first) moved++;
        }
      }
      expect(moved).toBeGreaterThan(50);
    });

  it('leaves a dragged row out of where it was', () => {
    const h = mount(across, 'canvas.a');
    const e = center(rowAt(h.box, 'canvas.e'));
    h.aim(e.r.right - 4, e.r.bottom - 4);
    expect(h.box.querySelector('[data-pref-path="canvas.a"]')).toBeNull();
    expect(placeholder(h.box)!.textContent).toContain('Alpha');
    expect(h.box.textContent!.match(/Alpha/g)).toHaveLength(1);
  });
});

it('reads rows where they are after the pane scrolls under a drag', () => {
  const h = mount(1, undefined, 200);
  const pane = h.box.querySelector('[data-pref-into]')!;
  const a = center(rowAt(h.box, 'canvas.a'));
  const there = h.aim(a.x, a.r.top + 2 + 60);
  expect(there?.path).not.toBe('canvas.a');
  h.aim(a.x, a.r.top + 2);
  // With a drop drawn, the rows are read from the form as it lay before the drop, moved by the scroll since.
  pane.scrollTop = 60;
  expect(pane.scrollTop).toBe(60);
  expect(h.aim(a.x, a.r.top + 2)).toEqual(there);
});

it('reads the page a drag opened, not the one open when it began', () => {
  const h = mount(2);
  const entry = center(h.box.querySelector('[data-pref-rail="io"]')!);
  expect(h.aim(entry.x, entry.y)).toEqual({ path: 'io', where: 'into', rail: true });
  h.select('io');
  const author = center(rowAt(h.box, 'io.author'));
  expect(h.aim(author.r.left + 4, author.y)).toEqual({ path: 'io.author', where: 'before' });
});

it('drops beside a rail entry from its ends and into it from its middle', () => {
  const h = mount(2);
  const { x, r } = center(h.box.querySelector('[data-pref-rail="io"]')!);
  expect(h.aim(x, r.top + 2)).toEqual({ path: 'io', where: 'before', rail: true });
  expect(h.aim(x, r.bottom - 2)).toEqual({ path: 'io', where: 'after', rail: true });
  expect(h.aim(x, r.top + r.height / 2)).toEqual({ path: 'io', where: 'into', rail: true });
});

it('drops beside a rail entry from either half when asked never to drop into one', () => {
  const h = mount(2);
  const { x, r } = center(h.box.querySelector('[data-pref-rail="io"]')!);
  const beside = (y: number) => prefDropTargetAt(h.box, x, y, { railInto: false });
  expect(beside(r.top + r.height / 2 - 2)).toEqual({ path: 'io', where: 'before', rail: true });
  expect(beside(r.top + r.height / 2 + 2)).toEqual({ path: 'io', where: 'after', rail: true });
});
