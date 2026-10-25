import '../../shell/shell.css';
import './CaptureView.browser.test.css';
import { cleanup, render } from '@testing-library/react';
import { f } from '@weasel-js/labkit/config';
import { afterEach, expect, it } from 'vitest';
import type { IndexBundle } from '../../story/indexBundle';
import type { LoadedStory } from '../../story/types';
import type { CapturePayload } from '../../vite/capture/payload';
import { CaptureView } from './CaptureView';

// Where a scroller stands is layout: a real browser's.

afterEach(cleanup);

const story: LoadedStory = {
  id: 'ui-tall--long',
  title: 'ui/Tall',
  name: 'Long',
  exportName: 'Long',
  config: {} as LoadedStory['config'],
  initialState: null,
  render: () => (
    <div className="fg-capture-test-tall">
      <div className="fg-capture-test-marker" />
    </div>
  ),
  decorators: [],
  layout: 'fullscreen',
  viewport: null,
  isolate: null,
  play: null,
  timeline: null,
};

const payload: CapturePayload = {
  story: story.id,
  isolate: false,
  config: {},
  state: null,
  globals: {},
  overrides: {},
  playhead: null,
  box: { width: 200, height: 100 },
  layout: 'fullscreen',
  dpr: 1,
  scroll: { left: 40, top: 300 },
  lab: { globals: {}, mode: 'light' },
  colorScheme: 'light',
};

it("renders the patch the screen's scroller stood at, not the story's top", async () => {
  let rendered = false;
  const { container } = render(<CaptureView subject={{ kind: 'story', story }} payload={payload} setup={{}} onRendered={() => (rendered = true)} />);
  await expect.poll(() => rendered).toBe(true);
  const box = container.querySelector<HTMLElement>('[data-fg-capture]')!.getBoundingClientRect();
  const marker = container.querySelector('.fg-capture-test-marker')!.getBoundingClientRect();
  expect(marker.top - box.top).toBe(0);
  expect(marker.left - box.left).toBe(0);
});

it("renders an isolated story at the patch its frame's document stood at", async () => {
  let rendered = false;
  const isolated = { ...payload, isolate: true };
  const { container } = render(<CaptureView subject={{ kind: 'story', story }} payload={isolated} setup={{}} onRendered={() => (rendered = true)} />);
  await expect.poll(() => rendered).toBe(true);
  const box = container.querySelector<HTMLElement>('[data-fg-capture]')!.getBoundingClientRect();
  const marker = container.querySelector('.fg-capture-test-marker')!.getBoundingClientRect();
  expect(marker.top - box.top).toBe(0);
  expect(marker.left - box.left).toBe(0);
});

it("renders an index page's story cells before it says it has painted", async () => {
  const cell: LoadedStory = {
    ...story,
    id: 'ui-tall--cell',
    name: 'Cell',
    exportName: 'Cell',
    config: f.schema({}) as LoadedStory['config'],
    render: () => <p className="fg-capture-test-cell">cell</p>,
  };
  const bundle: IndexBundle = { title: 'ui/Tall', library: 'ui', galleries: [], labs: [], stories: [cell], descriptions: {}, render: null };
  let rendered = false;
  const { container } = render(
    <CaptureView
      subject={{ kind: 'index', bundle }}
      payload={{ ...payload, story: 'ui-tall:index', box: { width: 600, height: 400 }, scroll: { left: 0, top: 0 } }}
      setup={{}}
      onRendered={() => (rendered = true)}
    />,
  );
  await expect.poll(() => rendered).toBe(true);
  expect(container.querySelector('.fg-capture-test-cell')?.textContent).toBe('cell');
});
