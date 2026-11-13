import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithIcons } from '../../testIcons';

let finish!: () => void;
vi.mock('@weasel-js/export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/export')>()),
  exportPagesPdf: () => new Promise((resolve) => { finish = () => resolve({ blob: new Blob(['%PDF']) }); }),
}));

const { StrokeTrimLabDemo } = await import('../StrokeTrimLabDemo');

// windease lays a lab's tiles out only once something measures them, and jsdom ships no ResizeObserver.
beforeAll(() => {
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

describe('StrokeTrimLabDemo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes no object URL for a PDF that finishes after the demo has gone', async () => {
    const made: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal('URL', Object.assign(class extends URL {}, {
      createObjectURL: () => { made.push(`blob:${made.length}`); return made.at(-1)!; },
      revokeObjectURL: (u: string) => { revoked.push(u); },
    }));
    const { findByRole, unmount } = renderWithIcons(<StrokeTrimLabDemo />);
    fireEvent.click(await findByRole('button', { name: 'Write PDF' }));
    unmount();
    await act(async () => { finish(); });
    expect(made.filter((u) => !revoked.includes(u))).toEqual([]);
  });
});
