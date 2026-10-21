import { render } from '@testing-library/react';
import { TrialIdContext } from '@weasel-js/labkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FrameSetup } from '../frame/FrameController';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { createTrialFrames, TrialFramesContext } from './trialFrames';
import { TrialHost } from './TrialHost';

const persisted = vi.hoisted(() => ({ value: { '--wzl-accent': 'red' } as Record<string, string> }));
vi.mock('./cssVars/overrides', () => ({ useCssOverrides: () => [persisted.value] }));

afterEach(() => {
  for (const el of Array.from(document.head.querySelectorAll('[data-fg-globals], [data-fg-overrides]'))) el.remove();
});

const COPY = { id: 't1~lens-a', globals: { mode: 'dark' } } as const;

function Pair({ withCopy, setup }: { withCopy: boolean; setup: FrameSetup }) {
  return (
    <TrialFramesContext.Provider value={frames}>
      <TrialIdContext.Provider value="t1">
        <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
          <TrialHost layout="padded" setup={setup} config={{}}>
            {() => <i>main</i>}
          </TrialHost>
          {withCopy ? (
            <TrialHost layout="padded" setup={setup} config={{}} copy={COPY}>
              {() => <i>copy</i>}
            </TrialHost>
          ) : null}
        </StoryGlobalsContext.Provider>
      </TrialIdContext.Provider>
    </TrialFramesContext.Provider>
  );
}

let frames = createTrialFrames();

describe('TrialHost copy', () => {
  it('scopes its globals to its own id, leaving the main host styled by its own', () => {
    frames = createTrialFrames();
    const applyGlobals = vi.fn();
    const { container } = render(<Pair withCopy setup={{ applyGlobals }} />);
    const [main, copyEl] = Array.from(container.querySelectorAll<HTMLElement>('.fg-story'));
    expect(main!.dataset.fgHost).toBe('t1');
    expect(copyEl!.dataset.fgHost).toBe('t1~lens-a');
    expect(copyEl!.hasAttribute('data-fg-copy')).toBe(true);
    expect(main!.hasAttribute('data-fg-copy')).toBe(false);
    expect(applyGlobals.mock.calls.find(([, t]) => t.root === main)![0]).toEqual({ mode: 'light' });
    expect(applyGlobals.mock.calls.find(([, t]) => t.root === copyEl)![0]).toEqual({ mode: 'dark' });
  });

  it('stays out of the frame registry: the main host stays connected through the copy mounting and unmounting', () => {
    frames = createTrialFrames();
    const setup: FrameSetup = {};
    const connected = () => frames.get('t1').send;
    const { rerender } = render(<Pair withCopy={false} setup={setup} />);
    const before = connected();
    expect(before).not.toBeNull();
    rerender(<Pair withCopy setup={setup} />);
    expect(connected()).toBe(before);
    rerender(<Pair withCopy={false} setup={setup} />);
    expect(connected()).toBe(before);
  });

  it('does not call onRendered', async () => {
    frames = createTrialFrames();
    const onRendered = vi.fn();
    render(
      <TrialHost layout="padded" setup={{}} config={{}} copy={COPY} onRendered={onRendered}>
        {() => <i>copy</i>}
      </TrialHost>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onRendered).not.toHaveBeenCalled();
  });

  it('carries the trial’s persisted CSS overrides under its own scope', () => {
    frames = createTrialFrames();
    render(<Pair withCopy setup={{}} />);
    const rules = Array.from(document.head.querySelectorAll('style[data-fg-overrides]')).map((s) => s.textContent ?? '');
    const own = rules.find((r) => r.includes('[data-fg-host="t1~lens-a"]'));
    expect(own).toContain('--wzl-accent: red;');
  });
});
