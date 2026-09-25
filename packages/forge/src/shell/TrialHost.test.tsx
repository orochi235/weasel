import { TrialIdContext } from '@weasel-js/labkit';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FrameSetup } from '../frame/FrameController';
import type { Globals } from '../protocol/messages';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { createTrialFrames, TrialFramesContext } from './trialFrames';
import { TrialHost } from './TrialHost';

afterEach(() => {
  for (const el of Array.from(document.head.querySelectorAll('[data-fg-globals], [data-fg-overrides]'))) el.remove();
});

const seen = (globals: Globals) => <p data-testid="globals">{JSON.stringify(globals)}</p>;

describe('TrialHost', () => {
  it('is a themed box: applies the globals to itself with a scope naming only it, and again when they change', () => {
    const applyGlobals = vi.fn();
    const setup: FrameSetup = { applyGlobals };
    const { container, rerender } = render(
      <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
        <TrialHost layout="padded" setup={setup} config={{}}>
          {seen}
        </TrialHost>
      </StoryGlobalsContext.Provider>,
    );
    const host = container.querySelector<HTMLElement>('.fg-story')!;
    expect(host.dataset.fgLayout).toBe('padded');
    const id = host.dataset.fgHost!;
    expect(applyGlobals).toHaveBeenCalledTimes(1);
    const [globals, target] = applyGlobals.mock.calls[0]!;
    expect(globals).toEqual({ mode: 'light' });
    expect(target.root).toBe(host);
    expect(target.scope).toBe(`[data-fg-host="${id}"]`);
    expect(document.querySelectorAll(target.scope)).toHaveLength(1);
    expect(container.querySelector('[data-testid="globals"]')?.textContent).toBe('{"mode":"light"}');

    rerender(
      <StoryGlobalsContext.Provider value={{ mode: 'dark' }}>
        <TrialHost layout="padded" setup={setup} config={{}}>
          {seen}
        </TrialHost>
      </StoryGlobalsContext.Provider>,
    );
    expect(applyGlobals).toHaveBeenCalledTimes(2);
    expect(applyGlobals.mock.calls[1]![0]).toEqual({ mode: 'dark' });
  });

  it("lets the trial's pins override the lab's globals", () => {
    const { container } = render(
      <StoryGlobalsContext.Provider value={{ mode: 'light', density: 'compact' }}>
        <TrialHost layout="padded" setup={{}} config={{ label: 'x', $globals: { mode: 'dark', density: 'lab' } }}>
          {seen}
        </TrialHost>
      </StoryGlobalsContext.Provider>,
    );
    expect(container.querySelector('[data-testid="globals"]')?.textContent).toBe('{"mode":"dark","density":"compact"}');
  });

  it("writes a setup's rule under its scope in one style element it removes on unmount", () => {
    const setup: FrameSetup = { applyGlobals: (_globals, { scope, style }) => style(`${scope} { color: red; }`) };
    const { container, unmount } = render(
      <TrialHost layout="padded" setup={setup} config={{}}>
        {seen}
      </TrialHost>,
    );
    const id = container.querySelector<HTMLElement>('.fg-story')!.dataset.fgHost!;
    const style = document.head.querySelector('style[data-fg-globals]');
    expect(style?.textContent).toBe(`[data-fg-host="${id}"] { color: red; }`);
    unmount();
    expect(document.head.querySelector('style[data-fg-globals]')).toBeNull();
  });

  it('connects itself to the trial registry: audits and captures answer directly, vars.set overrides on the host', async () => {
    const frames = createTrialFrames();
    const { container } = render(
      <TrialFramesContext.Provider value={frames}>
        <TrialIdContext.Provider value="t1">
          <TrialHost layout="padded" setup={{ cssVarsScope: ':root' }} config={{}}>
            {() => <button type="button">Hi</button>}
          </TrialHost>
        </TrialIdContext.Provider>
      </TrialFramesContext.Provider>,
    );
    const host = container.querySelector<HTMLElement>('.fg-story')!;
    const frame = frames.get('t1');
    expect(frames.hostRef('t1').current).toBe(host);
    expect(frame.send).not.toBeNull();
    expect(frame.audit).not.toBeNull();
    const picture = await frame.capture!();
    expect(picture.kind).toBe('svg');
    expect((picture as { markup: string }).markup).toContain('Hi');

    act(() => frame.send!({ type: 'vars.set', name: '--fg-t-host', value: 'blue' }));
    const rule = document.head.querySelector('style[data-fg-overrides]')?.textContent ?? '';
    expect(rule).toContain(`[data-fg-host="t1"]`);
    expect(rule).toContain('--fg-t-host: blue;');
  }, 20_000);

  it('audits with the page-level rules off, since the story is one box on a page of many', async () => {
    const frames = createTrialFrames();
    render(
      <TrialFramesContext.Provider value={frames}>
        <TrialIdContext.Provider value="t2">
          <TrialHost layout="padded" setup={{}} config={{}}>
            {() => <img src="cat.png" alt="" id="fg-t-decorative" />}
          </TrialHost>
        </TrialIdContext.Provider>
      </TrialFramesContext.Provider>,
    );
    const outcome = await frames.get('t2').audit!();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const ids = [...outcome.report.violations, ...outcome.report.incomplete].map((f) => f.id);
    expect(ids).not.toContain('region');
    expect(ids).not.toContain('page-has-heading-one');
    await waitFor(() => expect(frames.get('t2').a11y).toEqual(outcome));
  }, 20_000);

  it('unhides itself once its first commit has rendered', async () => {
    const onRendered = vi.fn();
    const { container } = render(
      <TrialHost layout="padded" setup={{}} config={{}} onRendered={onRendered}>
        {() => <span>x</span>}
      </TrialHost>,
    );
    await waitFor(() => expect(onRendered).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.fg-story')?.hasAttribute('data-pending')).toBe(false);
  });
});
