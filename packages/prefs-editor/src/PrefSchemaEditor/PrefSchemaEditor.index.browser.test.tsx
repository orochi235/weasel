import '@weasel-js/theme/tokens.css';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { IndexPage, loadStories, type IndexEnv } from '@weasel-js/forge/testing/frame';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import * as stories from './PrefSchemaEditor.stories';
import frame from './PrefSchemaEditor.stories.module.css';

// Which boxes scroll is layout, which jsdom does not compute.

afterEach(cleanup);

const scrolls = (el: Element) => {
  const { overflowY } = getComputedStyle(el);
  return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
};

const describe = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;

test('on its index page every story’s editor scrolls only inside its own panes, never its root or the frame around it', async () => {
  await page.viewport(1300, 800);
  const loaded = loadStories(stories as Record<string, unknown>, 'prefs-editor/PrefSchemaEditor');
  const env: IndexEnv = {
    title: 'prefs-editor/PrefSchemaEditor',
    stories: loaded,
    descriptions: {},
    globals: {},
    decorators: [],
    open: () => {},
    onError: () => {},
  };
  const { container } = renderWithIcons(
    // A trial host as forge's is: a size container, and the pane the index page scrolls in.
    <div style={{ width: 1280, height: 720, containerType: 'size' }}>
      <div style={{ height: '100%', overflow: 'auto' }}>
        <IndexPage env={env} render={null} />
      </div>
    </div>,
  );
  const stages = [...container.querySelectorAll<HTMLElement>('.fg-index-story__main .fg-index-cell__stage')];
  expect(stages).toHaveLength(loaded.length);
  const found: Record<string, string[]> = {};
  for (const [i, stage] of stages.entries()) {
    stage.scrollIntoView();
    // The story's frame, then the editor's root inside it.
    await expect.poll(() => stage.querySelector(`.${frame.frame} > *`), { timeout: 10_000 }).not.toBeNull();
    await new Promise((done) => setTimeout(done, 200));
    const editor = stage.querySelector(`.${frame.frame} > *`) as HTMLElement;
    const scrollers = [...stage.querySelectorAll('*'), stage].filter(scrolls);
    const outside = scrollers.filter((el) => el === editor || !editor.contains(el));
    // Each scroller is a pane of its own: none sits inside another, so a wheel never scrolls two boxes at once.
    const nested = scrollers.filter((el) => scrollers.some((other) => other !== el && other.contains(el)));
    found[loaded[i]!.name] = [...new Set([...outside, ...nested])].map(describe);
  }
  expect(found).toEqual(Object.fromEntries(loaded.map((story) => [story.name, []])));
});
