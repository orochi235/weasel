import '@weasel-js/theme/tokens.css';
import './index.css';
import './api.css';
import '../../shell/shell.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { ApiTable } from '../../story/api';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import type { IndexRender, LoadedStory } from '../../story/types';
import { type IndexEnv, IndexEnvContext, IndexPage, IndexStory } from './IndexPage';

// A cell's box is layout, which jsdom does not compute.

afterEach(cleanup);

function cell(layout: 'padded' | 'centered', specimenHeight: number) {
  const { container } = render(
    <figure className={`fg-index-cell fg-index-cell--${layout}`}>
      <div className="fg-index-cell__stage">
        <div className="specimen" style={{ width: 120, height: specimenHeight }} />
      </div>
    </figure>,
  );
  const stage = container.querySelector<HTMLElement>('.fg-index-cell__stage') as HTMLElement;
  const specimen = container.querySelector<HTMLElement>('.specimen') as HTMLElement;
  return { stage: stage.getBoundingClientRect(), specimen: specimen.getBoundingClientRect(), style: getComputedStyle(stage) };
}

test('a padded cell hugs a short specimen, with no room left under it', () => {
  const { stage, specimen, style } = cell('padded', 40);
  const below = stage.bottom - specimen.bottom;
  expect(below).toBeCloseTo(parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth), 1);
});

test('a cell draws no frame around its example', () => {
  const { style } = cell('centered', 40);
  expect(style.borderTopStyle).toBe('none');
});

test('a centered cell keeps its minimum and centers a short specimen in it', () => {
  const { stage, specimen } = cell('centered', 40);
  expect(stage.height).toBeGreaterThanOrEqual(96);
  expect(Math.abs(specimen.top - stage.top - (stage.bottom - specimen.bottom))).toBeLessThanOrEqual(1);
});

function fluidCell(layout: 'padded' | 'centered') {
  const { container } = render(
    <div style={{ width: 600 }}>
      <figure className={`fg-index-cell fg-index-cell--${layout}`}>
        <div className="fg-index-cell__stage">
          <div className="specimen" style={{ width: '100%', height: 20 }} />
        </div>
      </figure>
    </div>,
  );
  return (container.querySelector('.specimen') as HTMLElement).getBoundingClientRect();
}

// A slider, a tiled workspace: anything sized by its container has no width of its own to hug.
test('a padded cell gives a fluid specimen the column, as a page would', () => {
  expect(fluidCell('padded').width).toBeGreaterThan(500);
});

test('a centered cell gives a fluid specimen room instead of collapsing it', () => {
  expect(fluidCell('centered').width).toBeGreaterThan(200);
});

// In the workshop an index page sits in a scrolling pane, which clips a cell the window still has room for.
test('a cell mounts a viewport ahead inside a scrolling pane, and one far down the pane never does', async () => {
  await page.viewport(800, 600);
  const rendered: string[] = [];
  const stories = loadNativeModule(
    {
      default: meta({ title: 'ui/Cells' }),
      Ahead: story({ render: () => (rendered.push('ahead'), (<p data-story="ahead">ahead</p>)) }),
      Far: story({ render: () => (rendered.push('far'), (<p data-story="far">far</p>)) }),
    },
    'ui/Cells',
  );
  const env: IndexEnv = { title: 'ui/Cells', stories, descriptions: {}, globals: {}, decorators: [], open: () => {}, onError: () => {} };
  const [ahead, far] = stories as [LoadedStory, LoadedStory];
  render(
    <IndexEnvContext.Provider value={env}>
      <div style={{ position: 'fixed', left: 0, top: 0, width: 400, height: 200, overflow: 'auto' }}>
        <div style={{ height: 400 }} />
        <IndexStory story={ahead} />
        <div style={{ height: 5000 }} />
        <IndexStory story={far} />
      </div>
    </IndexEnvContext.Provider>,
  );
  await expect.poll(() => document.querySelector('[data-story="ahead"]')).not.toBeNull();
  await new Promise((done) => setTimeout(done, 300));
  expect(rendered).not.toContain('far');
});

function storyRow(width: number) {
  const stories = loadNativeModule(
    {
      default: meta({ title: 'ui/Row' }),
      Basic: story({ render: () => <div className="specimen" style={{ width: 240, height: 40 }} /> }),
    },
    'ui/Row',
  );
  const env: IndexEnv = {
    title: 'ui/Row',
    stories,
    descriptions: { [(stories[0] as LoadedStory).id]: 'What the story shows.' },
    globals: {},
    decorators: [],
    open: () => {},
    onError: () => {},
  };
  const { container } = render(
    <div style={{ width }}>
      <IndexPage env={env} render={null} />
    </div>,
  );
  const text = (container.querySelector('.fg-index-story__text') as HTMLElement).getBoundingClientRect();
  const example = (container.querySelector('.fg-index-story__main > .fg-index-cell') as HTMLElement).getBoundingClientRect();
  return { text, example };
}

test('a story’s example sits to the right of its title and description when there is room', async () => {
  await page.viewport(1200, 800);
  const { text, example } = storyRow(1000);
  expect(example.left).toBeGreaterThanOrEqual(text.right);
  expect(Math.abs(example.top - text.top)).toBeLessThanOrEqual(1);
});

test('in a narrow frame a story’s example wraps under its text instead of squeezing beside it', async () => {
  await page.viewport(1200, 800);
  const { text, example } = storyRow(420);
  expect(example.top).toBeGreaterThanOrEqual(text.bottom);
});

const API: ApiTable = {
  props: Array.from({ length: 30 }, (_, i) => ({ name: `prop${i}`, type: 'string', required: false })),
  inherited: [],
  ref: null,
};

/** An index page with an API panel, in a 600px-tall trial scroller as the workshop gives it. */
function apiPage(width: number, api: ApiTable = API, page: IndexRender | null = null) {
  const stories = loadNativeModule(
    {
      default: meta({ title: 'ui/Long' }),
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`S${i}`, story({ render: () => <p>story</p> })])),
    },
    'ui/Long',
  );
  const long = Array.from({ length: 20 }, () => 'A paragraph long enough to take a line or two of the column.').join('\n\n');
  const env: IndexEnv = {
    title: 'ui/Long',
    stories,
    descriptions: Object.fromEntries(stories.map((s) => [s.id, long])),
    globals: {},
    decorators: [],
    open: () => {},
    onError: () => {},
    api,
  };
  const { container } = render(
    <div className="fg-story" style={{ width, height: 600 }}>
      <div className="fg-story__scroll">
        <IndexPage env={env} render={page} />
      </div>
    </div>,
  );
  const get = (selector: string) => container.querySelector<HTMLElement>(selector) as HTMLElement;
  return { scroller: get('.fg-story__scroll'), aside: get('.fg-index-api'), head: get('.fg-index__head'), stories: get('.fg-index__stories') };
}

/** Scrolls the trial 2000px and checks the API is pinned to its top and no taller than it. */
function expectPinned({ scroller, aside }: { scroller: HTMLElement; aside: HTMLElement }) {
  scroller.scrollTop = 2000;
  expect(scroller.scrollTop).toBe(2000);
  expect(Math.abs(aside.getBoundingClientRect().top - scroller.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
  expect(aside.getBoundingClientRect().height).toBeLessThanOrEqual(600);
  expect(aside.scrollHeight).toBeGreaterThan(aside.clientHeight);
}

test("keeps the API column in view while the trial's own scroller scrolls", () => {
  expectPinned(apiPage(1600));
});

test('scrolls a custom page that places the generated one under a story in the one trial scroller', () => {
  expectPinned(apiPage(1600, API, ({ DefaultIndex }) => (
    <>
      <p className="intro">A story placed above the generated page.</p>
      <DefaultIndex />
    </>
  )));
});

test("keeps a custom page's own Api within the trial's height", () => {
  const { aside } = apiPage(1600, API, ({ Api }) => (
    <div>
      <Api />
    </div>
  ));
  expect(aside.getBoundingClientRect().height).toBeLessThanOrEqual(600);
});

test('puts the API beside the stories in a trial as wide as the workshop gives one', () => {
  const { aside, stories } = apiPage(700);
  expect(aside.getBoundingClientRect().left).toBeGreaterThanOrEqual(stories.getBoundingClientRect().right - 1);
});

test('stacks the API under the header below 560px', () => {
  const { aside, head, stories } = apiPage(500);
  expect(aside.getBoundingClientRect().top).toBeGreaterThanOrEqual(head.getBoundingClientRect().bottom - 1);
  expect(aside.getBoundingClientRect().bottom).toBeLessThanOrEqual(stories.getBoundingClientRect().top + 1);
});

test('wraps a long type inside the column', () => {
  const type = Array.from({ length: 40 }, (_, i) => `'option-${i}'`).join(' | ');
  const { scroller, aside } = apiPage(1600, { props: [{ name: 'wide', type, required: false }], inherited: [], ref: null });
  expect(scroller.scrollWidth).toBe(scroller.clientWidth);
  expect(aside.scrollWidth).toBe(aside.clientWidth);
});
