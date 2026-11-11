/**
 * Stateful property tests of the system-preference hooks against a model: the preference flips, readers mount
 * and unmount (following or not), and `matchMedia` comes and goes between them. Every mounted reader shows what
 * the model says it saw, a direct read agrees, and the subscriptions held are exactly the following readers'.
 */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_COLOR_SCHEME, systemColorScheme, useSystemColorScheme, type ColorScheme } from './colorScheme';
import { prefersReducedMotion, usePrefersReducedMotion } from './reducedMotion';
import { stubColorScheme, stubReducedMotion } from './testing/stubMatchMedia';
import { runs, tally, timeoutFor } from './pbt.fixture';

afterEach(() => { vi.unstubAllGlobals(); });

type Op =
  | { op: 'set'; value: boolean }
  | { op: 'mount'; follow: boolean }
  | { op: 'unmount'; pick: number };

const ops = fc.array(fc.oneof(
  fc.record({ op: fc.constant('set' as const), value: fc.boolean() }),
  fc.record({ op: fc.constant('mount' as const), follow: fc.boolean() }),
  fc.record({ op: fc.constant('unmount' as const), pick: fc.nat() }),
), { minLength: 1, maxLength: 15 });

interface Reader { shown: () => unknown; unmount: () => void; follow: boolean; saw: unknown }

/** Runs `steps` against one hook, `value(pref)` being what a reader shows for the preference. */
function check<T>(
  steps: Op[],
  initial: boolean,
  stub: (pref: boolean) => ((next: boolean) => void) & { listeners: Set<() => void> },
  useValue: (follow: boolean) => T,
  read: () => T,
  value: (pref: boolean) => T,
  seen: ReturnType<typeof tally>,
): void {
  const set = stub(initial);
  let pref = initial;
  const readers: Reader[] = [];
  for (const s of steps) {
    if (s.op === 'set') {
      seen.add(s.value === pref ? 'set-same' : 'set-flip');
      pref = s.value;
      act(() => set(s.value));
      for (const r of readers) if (r.follow) r.saw = value(pref);
    } else if (s.op === 'mount') {
      seen.add(s.follow ? 'mount-follow' : 'mount-still');
      let shown: T;
      function Probe(): null {
        shown = useValue(s.follow);
        return null;
      }
      const view = render(<Probe />);
      readers.push({ shown: () => shown, unmount: view.unmount, follow: s.follow, saw: value(pref) });
    } else if (readers.length > 0) {
      seen.add('unmount');
      const [r] = readers.splice(s.pick % readers.length, 1);
      r!.unmount();
    }
    for (const r of readers) expect(r.shown()).toBe(r.saw);
    expect(read()).toBe(value(pref));
    expect(set.listeners.size).toBe(readers.filter((r) => r.follow).length);
  }
  for (const r of readers.splice(0)) r.unmount();
  expect(set.listeners.size).toBe(0);
}

describe('system preference hooks against a model', () => {
  it('useSystemColorScheme shows the scheme each reader last heard, and holds one subscription per follower', () => {
    const seen = tally();
    fc.assert(fc.property(fc.boolean(), ops, (light, steps) => {
      const scheme = (l: boolean): ColorScheme => (l ? 'light' : 'dark');
      check(steps, light, (l) => {
        const set = stubColorScheme(scheme(l));
        return Object.assign((l2: boolean) => set(scheme(l2)), { listeners: set.listeners });
      }, (follow) => useSystemColorScheme(follow), systemColorScheme, scheme, seen);
      vi.unstubAllGlobals();
    }), runs(100));
    for (const k of ['set-flip', 'set-same', 'mount-follow', 'mount-still', 'unmount']) expect(seen.get(k), k).toBeGreaterThan(30);
  }, timeoutFor(100, 30));

  it('usePrefersReducedMotion shows the preference, and holds one subscription per reader', () => {
    const seen = tally();
    const always = ops.map((steps) => steps.map((s) => (s.op === 'mount' ? { ...s, follow: true } : s)));
    fc.assert(fc.property(fc.boolean(), always, (reduce, steps) => {
      check(steps, reduce, stubReducedMotion, () => usePrefersReducedMotion(), prefersReducedMotion, (r) => r, seen);
      vi.unstubAllGlobals();
    }), runs(100));
    for (const k of ['set-flip', 'mount-follow', 'unmount']) expect(seen.get(k), k).toBeGreaterThan(30);
  }, timeoutFor(100, 30));

  it('reads the default, and subscribes to nothing, wherever there is no matchMedia', () => {
    fc.assert(fc.property(fc.boolean(), (follow) => {
      vi.stubGlobal('matchMedia', undefined);
      let scheme: ColorScheme | undefined;
      let reduce: boolean | undefined;
      function Probe(): null {
        scheme = useSystemColorScheme(follow);
        reduce = usePrefersReducedMotion();
        return null;
      }
      const view = render(<Probe />);
      expect([scheme, reduce]).toEqual([DEFAULT_COLOR_SCHEME, false]);
      view.unmount();
      vi.unstubAllGlobals();
    }), runs(20));
  });
});
