import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamingDemo } from '../StreamingDemo';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const cells = (root: HTMLElement) => Number(/(\d+) cells/.exec(root.textContent ?? '')?.[1]);

async function renderAt(width: number, height: number) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() {} }) as DOMRect,
  );
  vi.useFakeTimers();
  const { container } = render(<StreamingDemo />);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  return container;
}

describe('StreamingDemo', () => {
  it('mounts on a canvas and asks for the cells of its first view', () => {
    const { container } = render(<StreamingDemo />);
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(container.textContent).toContain('undo 0');
  });

  it('asks for the cells of the whole canvas once the reader enlarges the stage', async () => {
    const small = cells(await renderAt(640, 400));
    cleanup();
    vi.restoreAllMocks();
    const large = cells(await renderAt(1200, 800));
    expect(large).toBeGreaterThan(small);
  });
});
