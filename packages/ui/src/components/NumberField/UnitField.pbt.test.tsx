/**
 * A model test of `UnitField` held by a parent that takes every commit: random typing (numbers with and without a
 * unit, offsets, text it cannot read, an emptied field), Enter, Escape, and spin keys. After each, the field shows the
 * model's text and the parent holds the model's value; text the field showed, typed back, commits the value it named.
 */
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { clampToBounds, decimal, parseAs, parseNumber, qty, spinKey } from '@weasel-js/quantity';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { UnitField } from './UnitField';

const RUNS = 80;
const CM = { mm: 0.1, cm: 1, m: 100 };
const DISPLAY = decimal({ maxPlaces: 20, grouping: false });
const shown = (n: number) => (Number.isNaN(n) ? '' : qty(n, DISPLAY).text);
const read = (text: string) => {
  const n = parseNumber(text, CM);
  return Number.isNaN(n) ? parseAs(text, DISPLAY) : n;
};

interface Bounds { step: number; min?: number; max?: number }
interface Model { value: number; draft: string | null; bounds: Bounds; seen: ReturnType<typeof tally> }
interface Real { field: HTMLInputElement; value: () => number }

function check(m: Model, r: Real): void {
  expect(r.value()).toBe(m.value);
  expect(r.field.value).toBe(m.draft ?? shown(m.value));
}

const settle = (n: number, b: Bounds) => {
  const c = clampToBounds(n, b);
  return Number.isFinite(c) ? c : Number.NaN;
};

class Type implements fc.Command<Model, Real> {
  constructor(readonly text: string) {}
  check = () => true;
  run(m: Model, r: Real) {
    act(() => { fireEvent.change(r.field, { target: { value: this.text } }); });
    m.draft = this.text;
    check(m, r);
  }
  toString = () => `type(${JSON.stringify(this.text)})`;
}

class Enter implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real) {
    act(() => { r.field.focus(); });
    act(() => { fireEvent.keyDown(r.field, { key: 'Enter' }); });
    if (m.draft !== null) {
      const off = /^\s*([+-])=\s*(.*)$/.exec(m.draft);
      const n = off ? m.value + (off[1] === '-' ? -1 : 1) * read(off[2]!) : read(m.draft);
      const next = settle(n, m.bounds);
      if (!Number.isNaN(next)) { if (next !== m.value) m.value = next; m.seen.count(off ? 'offset' : 'committed'); }
      else m.seen.count('reverted');
    }
    m.draft = null;
    check(m, r);
  }
  toString = () => 'Enter';
}

class Escape implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real) {
    act(() => { r.field.focus(); });
    act(() => { fireEvent.keyDown(r.field, { key: 'Escape' }); });
    if (m.draft !== null) m.seen.count('escaped');
    m.draft = null;
    check(m, r);
  }
  toString = () => 'Escape';
}

class Spin implements fc.Command<Model, Real> {
  constructor(readonly key: string) {}
  check = () => true;
  run(m: Model, r: Real) {
    act(() => { r.field.focus(); });
    act(() => { fireEvent.keyDown(r.field, { key: this.key }); });
    const typed = m.draft === null ? m.value : read(m.draft);
    const from = Number.isFinite(typed) ? typed : Number.isFinite(m.value) ? m.value : 0;
    const next = spinKey(this.key, from, m.bounds);
    if (next !== null) {
      m.seen.count(m.draft !== null && Number.isFinite(typed) ? 'spun from typing' : 'spun');
      if (next !== m.value) m.value = next;
      m.draft = null;
    }
    check(m, r);
  }
  toString = () => `key(${this.key})`;
}

/** Types back the text the field shows, and Enter: the value is unchanged. Not for a value finer than the default
 *  display's 20 places, which it shows rounded (open in docs/unruled.md). */
class Retype implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>) => m.draft === null && Number.isFinite(m.value) && read(shown(m.value)) === m.value;
  run(m: Model, r: Real) {
    const before = m.value;
    new Type(r.field.value).run(m, r);
    new Enter().run(m, r);
    expect(m.value).toBe(before);
    m.seen.count('retyped');
  }
  toString = () => 'retype';
}

const nice = fc.oneof(fc.integer({ min: -500, max: 500 }), fc.integer({ min: -50_000, max: 50_000 }).map((k) => k / 100), fc.double({ min: -1e6, max: 1e6, noNaN: true }));
const text = fc.oneof(
  nice.map((n) => shown(n)),
  fc.tuple(nice, fc.constantFrom('mm', 'cm', 'm', ' mm')).map(([n, u]) => `${shown(n)}${u}`),
  fc.tuple(fc.constantFrom('+=', '-=', ' += '), fc.integer({ min: 0, max: 40 }), fc.constantFrom('', 'mm')).map(([o, n, u]) => `${o}${n}${u}`),
  fc.constantFrom('', ' ', 'abc', '12ft', '1.2.3', '-', 'Infinity', '∞', '+=', '+=x'),
);
/** Typing straight into another key: Enter, the commonest edit, Escape, or a step. */
class TypeThen implements fc.Command<Model, Real> {
  constructor(readonly text: string, readonly then: fc.Command<Model, Real>) {}
  check = () => true;
  run(m: Model, r: Real) {
    new Type(this.text).run(m, r);
    this.then.run(m, r);
  }
  toString = () => `type(${JSON.stringify(this.text)}) ${this.then.toString()}`;
}
const SPIN_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];

const commands = fc.commands([
  text.map((s) => new Type(s)),
  text.map((s) => new TypeThen(s, new Enter())),
  text.map((s) => new TypeThen(s, new Enter())),
  text.map((s) => new TypeThen(s, new Escape())),
  fc.tuple(text, fc.constantFrom(...SPIN_KEYS)).map(([s, k]) => new TypeThen(s, new Spin(k))),
  fc.constant(new Enter()),
  fc.constant(new Escape()),
  fc.constantFrom(...SPIN_KEYS).map((k) => new Spin(k)),
  fc.constant(new Retype()),
], { maxCommands: 25 });

const boundsArb: fc.Arbitrary<Bounds> = fc.record({
  step: fc.constantFrom(1, 0.1, 0.25, 5),
  min: fc.option(fc.constantFrom(-100, 0, 0.5), { nil: undefined }),
  max: fc.option(fc.constantFrom(10, 99.9, 1000), { nil: undefined }),
});

describe('UnitField against a model', () => {
  it('shows and commits what the model does through typing, Enter, Escape, and spin keys', () => {
    const seen = tally();
    fc.assert(fc.property(boundsArb, fc.oneof(nice, fc.constant(Number.NaN)), commands, (bounds, start, cmds) => {
      const begin = Number.isNaN(start) ? start : settle(start, bounds);
      fc.pre(!Number.isNaN(begin) || Number.isNaN(start));
      let current = begin;
      function Holder() {
        const [value, setValue] = useState(begin);
        current = value;
        return <UnitField value={value} onChange={setValue} accepts={CM} aria-label="W" step={bounds.step} minValue={bounds.min} maxValue={bounds.max} />;
      }
      const { unmount } = render(<Holder />);
      try {
        const field = screen.getByRole('spinbutton', { name: 'W' }) as HTMLInputElement;
        fc.modelRun(() => ({ model: { value: begin, draft: null, bounds, seen }, real: { field, value: () => current } }), cmds);
      } finally {
        unmount();
      }
    }), runs(RUNS));
    for (const k of ['committed', 'offset', 'reverted', 'escaped', 'spun', 'spun from typing', 'retyped']) seen.atLeast(k, 5);
  }, timeoutFor(RUNS, 150));
});
