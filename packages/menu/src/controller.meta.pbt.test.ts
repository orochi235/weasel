/**
 * Metamorphic property tests of the menu controller on random menus. Laid out right to left, with Left and Right
 * swapped, it moves exactly as it does left to right. With `withLinks` over items given an `href`, it moves exactly
 * as it does without, and navigates to each href right after its item runs. And on a menu of up to a few thousand
 * rows, repeating one letter visits every row that starts with it, in order from the highlight, wrapping.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMenuController, SUBMENU_OPEN_MS, type MenuController, type MenuScheduler } from './controller';
import type { MenuEntry } from './entries';
import { withLinks } from './links';
import type { MenuDirection } from './placement';
import { entries, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const t = tally();

type Step =
  | { kind: 'key'; key: string }
  | { kind: 'hover'; level: number; index: number | null }
  | { kind: 'press'; level: number; index: number }
  | { kind: 'advance'; ms: number };

const KEYS = ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ',
  'Escape', '+', '-', 'a', 'A', 'b', 'c', 'ä', 'x'];
const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(...KEYS).map((key): Step => ({ kind: 'key', key })) },
  { weight: 2, arbitrary: fc.tuple(fc.nat(2), fc.option(fc.nat(3), { freq: 6 })).map(([level, index]): Step => ({ kind: 'hover', level, index })) },
  { weight: 1, arbitrary: fc.tuple(fc.nat(2), fc.nat(3)).map(([level, index]): Step => ({ kind: 'press', level, index })) },
  { weight: 1, arbitrary: fc.constantFrom(50, SUBMENU_OPEN_MS, 600).map((ms): Step => ({ kind: 'advance', ms })) },
);

interface Driven {
  c: MenuController;
  log: string[];
  advance(ms: number): void;
}

function fakeScheduler(): { s: MenuScheduler; advance(ms: number): void } {
  let now = 0;
  let timers: { at: number; fn: () => void }[] = [];
  return {
    s: {
      now: () => now,
      set(fn, ms) {
        const timer = { at: now + ms, fn };
        timers.push(timer);
        return () => { timers = timers.filter((x) => x !== timer); };
      },
    },
    advance(ms) {
      now += ms;
      const due = timers.filter((x) => x.at <= now);
      timers = timers.filter((x) => x.at > now);
      for (const x of due) x.fn();
    },
  };
}

/** A controller over `root`, logging what runs, navigates, reaches an edge, and closes, into `log`. */
function drive(root: readonly MenuEntry[], log: string[], first: boolean): Driven {
  const { s, advance } = fakeScheduler();
  const c = createMenuController({
    entries: root, highlightFirst: first, scheduler: s,
    onClose: () => { log.push('close'); }, onEdge: (d) => { log.push(`edge ${d}`); },
  });
  return { c, log, advance };
}

/** `root` with each item's `run` logging its key into `log`, and every `every`th item given an href. */
function bound(root: readonly MenuEntry[], log: string[], every: number): MenuEntry[] {
  let n = 0;
  return root.map((e): MenuEntry => {
    if (e.kind === 'submenu') return { ...e, entries: bound(e.entries, log, every) };
    if (e.kind !== 'item') return e;
    const href = n++ % every === 0 ? `/${e.key}` : undefined;
    return { ...e, ...(href === undefined ? {} : { href }), run: () => { log.push(`run ${e.key}`); } };
  });
}

function apply(d: Driven, s: Step, dir: MenuDirection, swap: boolean): void {
  if (s.kind === 'key') {
    const key = swap && s.key === 'ArrowLeft' ? 'ArrowRight' : swap && s.key === 'ArrowRight' ? 'ArrowLeft' : s.key;
    d.log.push(`key ${d.c.key(key, dir)}`);
  } else if (s.kind === 'hover') d.c.hover(s.level, s.index);
  else if (s.kind === 'press') d.c.press(s.level, s.index);
  else d.advance(s.ms);
}

describe('menu controller, metamorphic', () => {
  it('moves the same laid out right to left with Left and Right swapped', () => {
    fc.assert(fc.property(entries.filter((xs) => xs.length > 0), fc.boolean(), fc.array(step, { maxLength: 40 }), (root, first, steps) => {
      const a = drive(bound(root, [], 1), [], first);
      const ltrLog = a.log;
      const b = drive(bound(root, [], 1), [], first);
      for (const s of steps) {
        apply(a, s, 'ltr', false);
        apply(b, s, 'rtl', true);
        expect(b.c.stack()).toEqual(a.c.stack());
        expect(b.log).toEqual(ltrLog);
        if (a.c.stack().length > 1) t.count('rtl submenu');
      }
    }), runs(RUNS));
    t.atLeast('rtl submenu', RUNS / 5);
  }, timeoutFor(RUNS, 10));

  it('moves the same through withLinks, and navigates to each href right after its item runs', () => {
    fc.assert(fc.property(entries.filter((xs) => xs.length > 0), fc.boolean(), fc.integer({ min: 1, max: 3 }), fc.array(step, { maxLength: 40 }),
      (root, first, every, steps) => {
        const plainLog: string[] = [];
        const plain = drive(bound(root, plainLog, every), plainLog, first);
        const linkedLog: string[] = [];
        const linked = drive(withLinks(bound(root, linkedLog, every), (href) => { linkedLog.push(`go ${href}`); }), linkedLog, first);
        for (const s of steps) {
          apply(plain, s, 'ltr', false);
          apply(linked, s, 'ltr', false);
          expect(linked.c.stack()).toEqual(plain.c.stack());
        }
        // Each run of an item with an href is followed at once by going there; nothing else differs.
        const withHrefs: string[] = [];
        const hrefs = new Map<string, string>();
        const collect = (es: readonly MenuEntry[]): void => {
          for (const e of bound(es, [], every)) {
            if (e.kind === 'item' && e.href !== undefined) hrefs.set(e.key, e.href);
          }
          for (const e of es) if (e.kind === 'submenu') collect(e.entries);
        };
        collect(root);
        for (const line of plainLog) {
          withHrefs.push(line);
          const href = line.startsWith('run ') ? hrefs.get(line.slice(4)) : undefined;
          if (href !== undefined) { withHrefs.push(`go ${href}`); t.count('navigated'); }
        }
        expect(linkedLog).toEqual(withHrefs);
      }), runs(RUNS));
    t.atLeast('navigated', RUNS / 10);
  }, timeoutFor(RUNS, 10));
});

describe('menu controller, long menus', () => {
  it('repeating a letter visits each row that starts with it, in order from the highlight, wrapping', () => {
    const row = fc.tuple(fc.constantFrom('Apple', 'apricot', 'Banana', 'Ápex', '', 'Ab'), fc.constantFrom('item', 'item', 'item', 'separator', 'submenu', 'number'), fc.boolean());
    const many = fc.oneof(fc.array(row, { minLength: 1, maxLength: 12 }), fc.array(row, { minLength: 1000, maxLength: 3000, size: 'max' }));
    fc.assert(fc.property(many, fc.constantFrom('a', 'A', 'b'), fc.nat(),
      (rows, letter, start) => {
        const root: MenuEntry[] = rows.map(([label, kind, disabled], i): MenuEntry => {
          const key = `r${i}`;
          if (kind === 'separator') return { kind, key };
          if (kind === 'submenu') return { kind, key, label, disabled, entries: [] };
          if (kind === 'number') return { kind, key, label, disabled, value: 0, set: () => {} };
          return { kind: 'item', key, label, disabled, run: () => {} };
        });
        const starts = root.flatMap((e, i) => (e.kind !== 'separator' && e.label.toLowerCase().startsWith(letter.toLowerCase()) ? [i] : []));
        const { s, advance } = fakeScheduler();
        const c = createMenuController({ entries: root, scheduler: s, onClose: () => {} });
        const rowsAt = root.flatMap((e, i) => (e.kind === 'separator' ? [] : [i]));
        if (rowsAt.length > 0) c.hover(0, rowsAt[start % rowsAt.length]!);
        const from = c.stack()[0] ?? null;
        const after = from === null ? starts : [...starts.filter((i) => i > from), ...starts.filter((i) => i <= from)];
        const visits = Math.min(after.length * 2, 40);
        for (let k = 0; k < visits; k++) {
          advance(10);
          c.key(letter);
          expect(c.stack()).toEqual([after.length === 0 ? from : after[k % after.length]]);
        }
        t.count(after.length > 1 ? 'cycled' : 'one or none');
        if (rows.length > 1000) t.count('long');
      }), runs(RUNS / 4));
    t.atLeast('cycled', RUNS / 10);
    t.atLeast('long', RUNS / 40);
  }, timeoutFor(RUNS, 40));
});
