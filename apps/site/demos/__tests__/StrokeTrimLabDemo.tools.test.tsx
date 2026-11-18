import { beforeAll, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { ToolsApi } from '@weasel-js/core';
import { renderWithIcons } from '../../testIcons';

const seen: { tools: ToolsApi | null } = { tools: null };
vi.mock('@weasel-js/labkit', async (importOriginal) => {
  const labkit = await importOriginal<typeof import('@weasel-js/labkit')>();
  const Inner = labkit.TrialSceneCanvas;
  return {
    ...labkit,
    TrialSceneCanvas: (props: ComponentProps<typeof Inner>) => (
      <Inner {...props} onToolsCreated={(t) => { seen.tools = t; props.onToolsCreated?.(t); }} />
    ),
  };
});

const { StrokeTrimLabDemo } = await import('../StrokeTrimLabDemo');

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
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

describe('StrokeTrimLabDemo tools', () => {
  it('mounts every tool its palette offers', async () => {
    renderWithIcons(<StrokeTrimLabDemo />);
    await waitFor(() => expect(seen.tools).not.toBeNull());
    expect(Object.keys(seen.tools!.registry)).toEqual(expect.arrayContaining(['hand', 'select']));
  });
});
