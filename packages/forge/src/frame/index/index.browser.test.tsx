import '@weasel-js/theme/tokens.css';
import './index.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import type { LoadedStory } from '../../story/types';
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
