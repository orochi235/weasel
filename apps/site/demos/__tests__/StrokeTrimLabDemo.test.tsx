import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithIcons } from '../../testIcons';

let finish!: () => void;
let fail!: (err: Error) => void;
vi.mock('@weasel-js/pdf/export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/pdf/export')>()),
  exportRegionsPdf: () => new Promise((resolve, reject) => {
    finish = () => resolve(new Blob(['%PDF']));
    fail = reject;
  }),
}));
let svgFails = false;
vi.mock('@weasel-js/svg', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/svg')>();
  return {
    ...real,
    exportRegionSvg: ((...args: Parameters<typeof real.exportRegionSvg>) =>
      svgFails ? Promise.reject(new Error('svg refused')) : real.exportRegionSvg(...args)) as typeof real.exportRegionSvg,
  };
});

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
  afterEach(() => {
    vi.unstubAllGlobals();
    svgFails = false;
  });

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

  it('says so when the PDF export fails', async () => {
    const { findByRole } = renderWithIcons(<StrokeTrimLabDemo />);
    fireEvent.click(await findByRole('button', { name: 'Write PDF' }));
    await act(async () => { fail(new Error('pdf refused')); });
    expect((await findByRole('alert')).textContent).toContain('pdf refused');
  });

  it('says so when the SVG export fails', async () => {
    svgFails = true;
    const { findByRole } = renderWithIcons(<StrokeTrimLabDemo />);
    expect((await findByRole('alert')).textContent).toContain('svg refused');
  });
});
