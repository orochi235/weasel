import '@weasel-js/forge/shell.css';
import '@weasel-js/forge/frame.css';
import { loadStories, runAxe, runStory } from '@weasel-js/forge/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KNOWN, UNSWEPT } from './a11y.known';
import { shardOf } from './a11y.shards';
import setup from './forge.frame';

// Every story of ui and labkit, rendered as the workshop renders it and judged by axe in light and dark mode.
const modules = import.meta.glob(['../../packages/ui/src/**/*.stories.{ts,tsx}', '../../packages/labkit/src/**/*.stories.{ts,tsx}']);

/** Rules off for every story, each with why. */
const OFF: Readonly<Record<string, string>> = {
  'heading-order': 'a story is a fragment with no page outline around it to place its headings in',
  'label-content-name-mismatch':
    'flags controls showing a value, a count or a shortcut beside a name taken from what they edit, which WCAG 2.5.3 leaves alone',
};

/** Rules from {@link OFF} a story file is still judged on, by story file under `packages/`. */
const JUDGED: Readonly<Record<string, readonly string[]>> = {
  'ui/src/components/BandEditor/BandEditor.stories.tsx': ['label-content-name-mismatch'],
};

/**
 * What the sweep needs from `vitest/browser`, which only a browser test file may import: each shard's
 * file passes its `page` and `userEvent` in.
 */
export interface Browser {
  page: { screenshot(options: { element: Element; save: false }): Promise<string> };
  userEvent: { keyboard(text: string): Promise<unknown> };
}

let browser: Browser;

const MODES = ['light', 'dark'] as const;
const FOCUS_RING = 'focus-ring';

/** `packages/ui/src/components/Button/Button.stories.tsx` → `ui/components/Button`: the package leads, as labkit's frame decorator expects. */
const titleOf = (path: string) => {
  const [, pkg, rest] = /packages\/([^/]+)\/src\/(.*)\/[^/]+$/.exec(path) ?? [];
  return `${pkg}/${rest}`;
};

/** Waits out every finite animation in `host`, its own fade-in included: axe judges text by the opacity it has now. */
const settled = (host: HTMLElement) =>
  Promise.all(
    host.getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
      .map((a) => a.finished.catch(() => {})),
  );

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';
const LOOK = [
  'outline-style', 'outline-width', 'outline-color', 'box-shadow', 'background-color', 'color', 'stroke', 'stroke-width', 'fill',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
];

/** How `el`, its parent and its first child are drawn: a ring may be painted on any of the three. */
const lookOf = (el: Element) =>
  [el, el.parentElement, el.firstElementChild]
    .map((part) => (part ? LOOK.map((p) => getComputedStyle(part).getPropertyValue(p)).join(' ') : ''))
    .join(' | ');

const shown = (el: Element) => {
  const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
  return `<${el.tagName.toLowerCase()}${el.getAttribute('role') ? ` role=${el.getAttribute('role')}` : ''}> "${name}"`;
};

/** A picture of what is drawn over `el`'s box and a few pixels around it, where a ring would be. */
async function shotOf(el: Element): Promise<string> {
  const box = el.getBoundingClientRect();
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    position: 'fixed', pointerEvents: 'none', left: `${box.left - 4}px`, top: `${box.top - 4}px`,
    width: `${box.width + 8}px`, height: `${box.height + 8}px`,
  });
  document.body.append(frame);
  try {
    return await browser.page.screenshot({ element: frame, save: false });
  } finally {
    frame.remove();
  }
}

/**
 * Tabs through `host` from just before it, as a keyboard does, and returns each element Tab reached that is drawn
 * the same focused as not: the same styles on it, its parent and its first child, and failing that the same pixels.
 */
async function unringed(host: HTMLElement, max = 40): Promise<string[]> {
  // An autofocused field is read unfocused too.
  (document.activeElement as HTMLElement | null)?.blur();
  const before = new Map<Element, string>();
  for (const el of host.querySelectorAll(FOCUSABLE)) before.set(el, lookOf(el));
  const start = document.createElement('button');
  start.textContent = 'start';
  host.before(start);
  // A caret blinks: a field would differ between two pictures with no ring at all.
  const still = document.createElement('style');
  still.textContent = '* { caret-color: transparent !important; }';
  document.head.append(still);
  const out: string[] = [];
  const reached = new Set<Element>();
  try {
    start.focus();
    for (let i = 0; i < max; i++) {
      await browser.userEvent.keyboard('{Tab}');
      const el = document.activeElement as HTMLElement | null;
      if (!el || !host.contains(el) || reached.has(el)) break;
      reached.add(el);
      // A ring that fades in is read once it has.
      await Promise.all(
        [el, el.parentElement, el.firstElementChild].flatMap((part) => part?.getAnimations() ?? [])
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
      const was = before.get(el);
      if (was === undefined || was !== lookOf(el)) continue;
      const focused = await shotOf(el);
      start.focus();
      // A modal that keeps focus leaves nothing to compare against.
      const left = document.activeElement === start;
      const unfocused = left ? await shotOf(el) : '';
      el.focus();
      if (left && focused === unfocused) out.push(shown(el));
    }
  } finally {
    (document.activeElement as HTMLElement | null)?.blur();
    start.remove();
    still.remove();
  }
  return out;
}

const judgeFile = (path: string) => {
  if (Object.hasOwn(UNSWEPT, path.replace('../../packages/', ''))) {
    it.skip(`is not swept: ${UNSWEPT[path.replace('../../packages/', '')]}`, () => {});
    return;
  }
  const known = KNOWN[path.replace('../../packages/', '')] ?? {};
  const judged = JUDGED[path.replace('../../packages/', '')] ?? [];
  const off = Object.keys(OFF).filter((rule) => !judged.includes(rule));
  const seen = new Set<string>();
  let runs = 0;

  it.each(MODES)('passes axe in %s mode', async (mode) => {
    const mod = (await modules[path]!()) as Record<string, unknown>;
    const title = titleOf(path);
    const found: string[] = [];
    for (const story of loadStories(mod, title, setup.parameters)) {
      if (story.isolate !== null) continue;
      await runStory(mod, story.exportName, path, title, {
        setup,
        globals: { mode },
        check: async (host) => {
          await settled(host);
          expect(host.closest('[data-wzl-mode]')?.getAttribute('data-wzl-mode')).toBe(mode);
          const report = await runAxe(host, { page: false, off });
          for (const v of report.violations) {
            if (Object.hasOwn(known, v.id)) {
              seen.add(v.id);
              continue;
            }
            for (const node of v.nodes) found.push(`${story.name}: ${v.id} (${v.impact}) ${node.target.join(' ')}\n    ${node.html.slice(0, 240)}\n    ${node.failureSummary ?? v.help}`);
          }
          // Not an axe rule: every stop Tab reaches draws a ring. Checked in one mode, to halve the tabbing.
          if (mode !== 'light') return;
          const bare = await unringed(host);
          if (bare.length > 0 && Object.hasOwn(known, FOCUS_RING)) seen.add(FOCUS_RING);
          else for (const el of bare) found.push(`${story.name}: ${FOCUS_RING} ${el}`);
        },
      });
    }
    runs += 1;
    if (found.length > 0) throw new Error(`${found.length} violation(s):\n${found.join('\n')}`);
  }, 120_000);

  it.runIf(Object.keys(known).length > 0)('still has every violation KNOWN lists for it', () => {
    if (runs < MODES.length) return;
    expect(Object.keys(known).filter((rule) => !seen.has(rule))).toEqual([]);
  });
};

/**
 * Judges one shard of the story files (`a11y.shards.ts`). One file judging all of them ran 473 s, longer than
 * the rest of the browser project took across 18 tabs (teitou, 2026-11-19); each `a11y.<n>.browser.test.tsx`
 * calls this with its own shard, so the tabs share them.
 */
export const describeA11y = (shard: number, from: Browser) => {
  browser = from;
  // Stories mount outside act() and the sweep waits like a user; testing-library, imported beside it, turns act on.
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let was: boolean | undefined;
  beforeAll(() => { was = env.IS_REACT_ACT_ENVIRONMENT; env.IS_REACT_ACT_ENVIRONMENT = false; });
  afterAll(() => { env.IS_REACT_ACT_ENVIRONMENT = was; });
  describe.each(shardOf(Object.keys(modules), shard))('%s', judgeFile);
};
