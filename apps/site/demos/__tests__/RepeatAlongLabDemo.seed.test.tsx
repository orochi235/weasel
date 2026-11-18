import { act, cleanup } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import type { ComponentProps } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LabContextValue } from '@weasel-js/labkit';
import type { PathEffectProbe } from '../pathEffectLab';
import { withIcons } from '../../testIcons';

// The lab, with a hand on its context so a test can open a trial on a config seed, as a link to one does.
const lab: { ctx: LabContextValue | null } = { ctx: null };
vi.mock('@weasel-js/labkit', async (importOriginal) => {
  const labkit = await importOriginal<typeof import('@weasel-js/labkit')>();
  const Grab = () => { lab.ctx = labkit.useLabContext(); return null; };
  return {
    ...labkit,
    Lab: (props: ComponentProps<typeof labkit.Lab>) => <labkit.Lab {...props}><Grab /></labkit.Lab>,
  };
});

const { RepeatAlongLabDemo } = await import('../RepeatAlongLabDemo');

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.#cb = cb; }
    observe(target: Element) {
      this.#cb([{ target, contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const copies = () => window.__weaselTest!.probe<PathEffectProbe>('pathEffects')!.copies!.length;

describe('RepeatAlongLabDemo, seeded', () => {
  it('opens a trial seeded with a copy count on that count, and resets to it', async () => {
    await renderSettled(<RepeatAlongLabDemo />, { wrapper: withIcons });
    expect(copies()).toBe(9);
    const first = lab.ctx!.trials[0]!.id;
    await act(async () => { lab.ctx!.swapTrial(first, 'Repeat along a path', { config: { count: 20 } }); });
    expect(copies()).toBe(20);
    const seeded = lab.ctx!.trials[0]!.id;
    await act(async () => { lab.ctx!.resetTrial(seeded); });
    expect(copies()).toBe(20);
  });
});
