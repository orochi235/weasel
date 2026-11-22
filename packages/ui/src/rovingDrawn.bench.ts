/**
 * What useRovingTabIndex's drawn check costs under jsdom, which has no `checkVisibility`. Run as one vitest test:
 * `npx vitest run --config tests/perf/vitest.scene-bench.config.ts --reporter=default packages/ui/src/rovingDrawn.bench.ts`.
 * Interleaves rounds of the check as it was (every ancestor up to `<html>`) and as it is (up to the container),
 * printing one JSON line per round; set `ROVING_BENCH_OUT` to also append them to that file.
 */
import { appendFileSync } from 'node:fs';
import { createElement as h, type ReactElement } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useRovingTabIndex } from './useRovingTabIndex';

const ROWS = 200;
const DEPTH = 20;
const RERENDERS = 100;
const ARROWS = 20;
const ROUNDS = 6;

let arm: 'was' | 'is' = 'is';

/** The fallback before the walk stopped at the container, kept as the baseline. */
function renderedWas(el: HTMLElement): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  if (view.getComputedStyle(el).visibility !== 'visible') return false;
  for (let at: Element | null = el; at; at = at.parentElement) {
    if (view.getComputedStyle(at).display === 'none') return false;
  }
  return true;
}

vi.mock('./isRendered', async (load) => {
  const real = await load<typeof import('./isRendered')>();
  return { isRendered: (el: HTMLElement, within?: Element | null) => (arm === 'was' ? renderedWas(el) : real.isRendered(el, within)) };
});

function List({ tick }: { tick: number }): ReactElement {
  const roving = useRovingTabIndex<HTMLUListElement>({ itemSelector: '[role="option"]', orientation: 'vertical' });
  const rows = Array.from({ length: ROWS }, (_, i) => h('li', { key: i, role: 'option', className: 'row' }, `row ${i} ${tick}`));
  let tree: ReactElement = h('ul', { ref: roving.rootRef, onKeyDown: roving.onKeyDown, role: 'listbox', className: 'list' }, rows);
  for (let i = 0; i < DEPTH; i++) tree = h('div', { className: `pane pane-${i}` }, tree);
  return tree;
}

function round(which: 'was' | 'is') {
  arm = which;
  const sheet = document.head.appendChild(document.createElement('style'));
  sheet.textContent = Array.from({ length: DEPTH }, (_, i) => `.pane-${i} { padding: ${i}px }`).join('\n') + '\n.row { color: gray }';
  const spy = vi.spyOn(window, 'getComputedStyle');
  const view = render(h(List, { tick: 0 }));
  let t0 = performance.now();
  for (let tick = 1; tick <= RERENDERS; tick++) view.rerender(h(List, { tick }));
  const rerenderMs = performance.now() - t0;
  const rerenderCalls = spy.mock.calls.length;
  const first = view.container.querySelector<HTMLElement>('[role="option"]')!;
  act(() => first.focus());
  spy.mockClear();
  t0 = performance.now();
  for (let k = 0; k < ARROWS; k++) fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  const arrowMs = performance.now() - t0;
  const arrowCalls = spy.mock.calls.length;
  expect(document.activeElement?.textContent).toMatch(new RegExp(`^row ${ARROWS} `));
  spy.mockRestore();
  cleanup();
  sheet.remove();
  return { rerenderMs, rerenderCalls, arrowMs, arrowCalls };
}

it('the drawn check, the walk to <html> against the walk to the container', { timeout: 600_000 }, () => {
  const out = process.env.ROVING_BENCH_OUT;
  const conditions = { node: process.version, rows: ROWS, depth: DEPTH, rerenders: RERENDERS, arrows: ARROWS };
  round('was');
  round('is');
  for (let r = 0; r < ROUNDS; r++) {
    for (const which of r % 2 === 0 ? (['was', 'is'] as const) : (['is', 'was'] as const)) {
      const record = { round: r + 1, of: ROUNDS, arm: which, ...round(which), ...conditions, at: new Date().toISOString() };
      const line = JSON.stringify(record);
      process.stdout.write(line + '\n');
      if (out) appendFileSync(out, line + '\n');
    }
  }
});
