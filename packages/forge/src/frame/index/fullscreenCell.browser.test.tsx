import '@weasel-js/theme/tokens.css';
import './index.css';
import '../../shell/shell.css';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { meta, story } from '@weasel-js/forge';
import { IndexPage, loadNativeModule, type IndexEnv } from '@weasel-js/forge/testing/frame';
import type { Layout } from '../../protocol/messages';

// A cell's height is layout, which jsdom does not compute.

afterEach(cleanup);

const TRIAL_HEIGHT = 600;

/** An index page of one story, in a trial host as the workshop gives it. */
async function indexOf(layout: Layout, body: () => ReactNode) {
  await page.viewport(1200, 900);
  const stories = loadNativeModule({ default: meta({ title: 'ui/Fit' }), Only: story({ layout, render: body }) }, 'ui/Fit');
  const env: IndexEnv = { title: 'ui/Fit', stories, descriptions: {}, globals: {}, decorators: [], open: () => {}, onError: () => {} };
  const { container } = render(
    <div className="fg-story" style={{ width: 1000, height: TRIAL_HEIGHT }}>
      <div className="fg-story__scroll">
        <IndexPage env={env} render={null} />
      </div>
    </div>,
  );
  await expect.poll(() => container.querySelector('[data-body]')).not.toBeNull();
  // The fit lands from a ResizeObserver, a frame after the story mounts.
  await new Promise((done) => setTimeout(done, 100));
  const get = (selector: string) => container.querySelector<HTMLElement>(selector) as HTMLElement;
  return { stage: get('.fg-index-cell__stage'), stories: get('.fg-index__stories'), body: get('[data-body]') };
}

const scrolls = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1;

test('a fullscreen story taller than the trial gets a stage that shows it whole, as wide as the column', async () => {
  const { stage, stories, body } = await indexOf('fullscreen', () => <div data-body="" style={{ height: 1500 }} />);
  expect(scrolls(stage)).toBe(false);
  expect(stage.getBoundingClientRect().height).toBeGreaterThanOrEqual(1500);
  expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(stage.getBoundingClientRect().bottom + 1);
  expect(stage.getBoundingClientRect().width).toBeGreaterThan(stories.getBoundingClientRect().width - 2);
});

test('a fullscreen story that fills its box gets the trial’s height, and only its own pane scrolls', async () => {
  const { stage, body } = await indexOf('fullscreen', () => (
    <div data-body="" style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: 3000 }} />
    </div>
  ));
  expect(Math.abs(stage.getBoundingClientRect().height - TRIAL_HEIGHT)).toBeLessThanOrEqual(1);
  expect(scrolls(stage)).toBe(false);
  expect(scrolls(body)).toBe(true);
});

test('a fullscreen story whose box asks for more than the trial gets exactly that, and holds it', async () => {
  const { stage } = await indexOf('fullscreen', () => <div data-body="" style={{ height: '100%', minHeight: 800 }} />);
  expect(Math.abs(stage.getBoundingClientRect().height - 800)).toBeLessThanOrEqual(1);
  await new Promise((done) => setTimeout(done, 200));
  expect(Math.abs(stage.getBoundingClientRect().height - 800)).toBeLessThanOrEqual(1);
  expect(scrolls(stage)).toBe(false);
});

test('a centered story stays compact beside its text', async () => {
  const { stage, stories } = await indexOf('centered', () => <div data-body="" style={{ width: 120, height: 40 }} />);
  expect(stage.getBoundingClientRect().height).toBeLessThan(200);
  expect(stage.getBoundingClientRect().width).toBeLessThan(stories.getBoundingClientRect().width / 2);
});
