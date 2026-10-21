import { render, screen, waitFor } from '@testing-library/react';
import { interstellarTheme } from '@weasel-js/labkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturePayload } from '../../vite/capture/payload';
import type { LoadedStory, StoryContext } from '../../story/types';
import { usePlayhead } from '../../timeline/context';
import type { FrameSetup } from '../FrameController';
import { CaptureView } from './CaptureView';

afterEach(() => {
  for (const el of Array.from(document.head.querySelectorAll('[data-fg-globals], [data-fg-overrides]'))) el.remove();
});

function Shown({ ctx }: { ctx: StoryContext }) {
  const time = usePlayhead();
  return (
    <p>
      {`${String((ctx.config as { label: string }).label)} at ${time} in ${String(ctx.globals.mode)}, count ${String((ctx.state as { count: number }).count)}`}
    </p>
  );
}

const story: LoadedStory = {
  id: 'ui-clip--play',
  title: 'ui/Clip',
  name: 'Play',
  exportName: 'Play',
  config: {} as LoadedStory['config'],
  initialState: null,
  render: (ctx) => <Shown ctx={ctx} />,
  decorators: [],
  layout: 'padded',
  viewport: null,
  isolate: null,
  play: null,
  timeline: () => ({ duration: 1000 }),
};

const payload: CapturePayload = {
  story: story.id,
  isolate: false,
  config: { label: 'Clip' },
  state: { count: 3 },
  globals: { mode: 'dark' },
  overrides: { '--wzl-accent': 'red' },
  playhead: 120,
  box: { width: 320, height: 200 },
  layout: 'padded',
  dpr: 2,
  scroll: { left: 0, top: 0 },
  lab: { globals: { theme: 'chrome' }, mode: 'light' },
};

describe('CaptureView', () => {
  it('renders the story at its playhead, globals and overrides in a box of the payload’s size', async () => {
    const applyGlobals = vi.fn();
    const setup: FrameSetup = { applyGlobals };
    const onRendered = vi.fn();
    const { container } = render(<CaptureView story={story} payload={payload} setup={setup} onRendered={onRendered} />);

    expect(screen.getByText('Clip at 120 in dark, count 3')).toBeTruthy();

    const box = container.querySelector<HTMLElement>('.fg-story[data-fg-host="capture"][data-fg-capture]');
    expect(box).not.toBeNull();
    // Proxy: jsdom applies no stylesheet, so the box's size is asserted as the custom properties capture.css reads.
    expect(box!.style.getPropertyValue('--fg-capture-w')).toBe('320px');
    expect(box!.style.getPropertyValue('--fg-capture-h')).toBe('200px');
    expect(box!.dataset.fgLayout).toBe('padded');

    expect(applyGlobals).toHaveBeenCalledWith({ mode: 'dark' }, expect.objectContaining({ root: box }));
    const rules = Array.from(document.head.querySelectorAll('style[data-fg-overrides]')).map((s) => s.textContent ?? '');
    expect(rules.find((r) => r.includes('[data-fg-host="capture"]'))).toContain('--wzl-accent: red;');

    await waitFor(() => expect(onRendered).toHaveBeenCalledTimes(1));
  });

  it('renders the story under the lab’s theme, at the lab’s mode', async () => {
    const theme = { ...interstellarTheme, name: 'chrome-test' };
    const labTheme = vi.fn(() => theme);
    const onRendered = vi.fn();
    const dark = { ...payload, lab: { globals: { theme: 'chrome' }, mode: 'dark' as const } };
    const { container } = render(<CaptureView story={story} payload={dark} setup={{}} labTheme={labTheme} onRendered={onRendered} />);
    const box = container.querySelector<HTMLElement>('[data-fg-capture]')!;
    const themed = box.closest<HTMLElement>('[data-wzl-theme]');
    expect(themed?.dataset.wzlTheme).toBe('chrome-test');
    expect(themed?.dataset.wzlMode).toBe('dark');
    expect(themed?.dataset.wzlDensity).toBe('roomy');
    expect(box.closest('.lk-root')).not.toBeNull();
    expect(labTheme).toHaveBeenCalledWith({ theme: 'chrome' });
    await waitFor(() => expect(onRendered).toHaveBeenCalled());
  });
});
