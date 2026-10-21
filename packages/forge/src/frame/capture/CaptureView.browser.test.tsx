import '../../shell/shell.css';
import './CaptureView.browser.test.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
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
  const { container } = render(<CaptureView story={story} payload={payload} setup={{}} onRendered={() => (rendered = true)} />);
  await expect.poll(() => rendered).toBe(true);
  const box = container.querySelector<HTMLElement>('[data-fg-capture]')!.getBoundingClientRect();
  const marker = container.querySelector('.fg-capture-test-marker')!.getBoundingClientRect();
  expect(marker.top - box.top).toBe(0);
  expect(marker.left - box.left).toBe(0);
});
