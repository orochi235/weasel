import { afterEach, describe, expect, it } from 'vitest';
import { csfChecks } from './e2e/stories.mjs';

/** A story host as TrialHost renders one in dev: the scroller, then devtoolsDock's box-less wrapper, then the story. */
function host(story: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fg-story';
  el.dataset.fgHost = 'h1';
  const scroll = document.createElement('div');
  scroll.className = 'fg-story__scroll';
  const bare = document.createElement('div');
  bare.style.display = 'contents';
  bare.append(story);
  scroll.append(bare);
  el.append(scroll);
  document.body.append(el);
  return el;
}

const rect = (el: Element, top: number, height: number) => {
  el.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) });
};

/** Runs check `what` with `frame.evaluate` calling into `el`, as Playwright's locator would. */
const run = (what: RegExp, el: HTMLElement) => {
  const check = csfChecks.find((c) => what.test(c.what))!;
  const frame = { evaluate: async <T>(fn: (host: HTMLElement) => T) => fn(el) };
  return check.check({ frame, page: undefined });
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("forge csf checks' host reads", () => {
  it('find a LabRoot .lk-root below the scroller and the story wrappers', async () => {
    const theme = document.createElement('div');
    theme.dataset.wzlTheme = 'default';
    const root = document.createElement('div');
    root.className = 'lk-root';
    root.append(document.createElement('span'));
    theme.append(root);
    await expect(run(/\.lk-root decorator/, host(theme))).resolves.toBeUndefined();
  });

  it('measure the story, not the scroller around it', async () => {
    const story = document.createElement('div');
    const el = host(story);
    rect(el.querySelector('.fg-story__scroll')!, 10, 500);
    rect(story, 10, 0);
    await expect(run(/apps\/draw story/, el)).rejects.toThrow(/off screen/);
    rect(story, 10, 200);
    await expect(run(/apps\/draw story/, el)).resolves.toBeUndefined();
  });
});
