import '@weasel-js/forge/shell.css';
import '@weasel-js/forge/frame.css';
import { loadStories, runAxe, runStory } from '@weasel-js/forge/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KNOWN, UNSWEPT } from './a11y.known';
import { type Browser, finishing, unringed } from './a11y.ring';
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

let browser: Browser;

const MODES = ['light', 'dark'] as const;
const FOCUS_RING = 'focus-ring';

/** `packages/ui/src/components/Button/Button.stories.tsx` → `ui/components/Button`: the package leads, as labkit's frame decorator expects. */
const titleOf = (path: string) => {
  const [, pkg, rest] = /packages\/([^/]+)\/src\/(.*)\/[^/]+$/.exec(path) ?? [];
  return `${pkg}/${rest}`;
};

/** Waits out every finite animation in `host`, its own fade-in included: axe judges text by the opacity it has now. */
const settled = (host: HTMLElement) => finishing(host.getAnimations({ subtree: true }));

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
          const bare = await unringed(host, browser);
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
