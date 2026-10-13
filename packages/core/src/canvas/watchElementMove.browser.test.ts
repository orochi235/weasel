/** jsdom has no layout and no `IntersectionObserver`, so only a browser can run the watcher. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { watchElementMove } from './watchElementMove';

let page: HTMLDivElement | null = null;
let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  page?.remove();
  stop = null;
  page = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** A 200×100 box under a spacer whose height sets where the box sits. */
async function mount(): Promise<{ moveTo: (px: number) => void; box: HTMLDivElement }> {
  page = document.createElement('div');
  page.innerHTML = '<div style="height:80px"></div><div style="width:200px;height:100px"></div>';
  document.body.appendChild(page);
  const [spacer, box] = [...page.children] as HTMLDivElement[];
  return { moveTo: (px) => { spacer.style.height = `${px}px`; }, box };
}

/** Long enough for an observer made before it to have delivered its first report. */
const baseline = async () => { await frame(); await frame(); await new Promise((r) => setTimeout(r, 0)); };

describe('watchElementMove', () => {
  it('reports a move', async () => {
    const { moveTo, box } = await mount();
    const onMove = vi.fn();
    stop = watchElementMove(box, onMove);
    await baseline();
    moveTo(0);
    await expect.poll(() => onMove.mock.calls.length).toBe(1);
  });

  it('reports a move that lands before the rebuilt frame has reported', async () => {
    const { moveTo, box } = await mount();
    const onMove = vi.fn(() => {
      // A microtask runs once the watcher has rebuilt its frame, and before that frame's first report.
      if (onMove.mock.calls.length === 1) queueMicrotask(() => moveTo(300));
    });
    stop = watchElementMove(box, onMove);
    await baseline();
    moveTo(0);
    await expect.poll(() => onMove.mock.calls.length).toBe(2);
  });

  it('reports a move made while the element is off the root', async () => {
    const { moveTo, box } = await mount();
    moveTo(5000);
    const onMove = vi.fn();
    stop = watchElementMove(box, onMove);
    await baseline();
    moveTo(6000);
    await expect.poll(() => onMove.mock.calls.length, { timeout: 4000 }).toBeGreaterThanOrEqual(1);
  });

  it('stays quiet for a still element at a fractional, transformed position', async () => {
    const { box } = await mount();
    page!.style.cssText = 'transform: translate(3.3px, 7.7px) scale(1.37); transform-origin: 0 0';
    const onMove = vi.fn();
    stop = watchElementMove(box, onMove);
    await new Promise((r) => setTimeout(r, 400));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('stops reporting once stopped', async () => {
    const { moveTo, box } = await mount();
    const onMove = vi.fn();
    stop = watchElementMove(box, onMove);
    await baseline();
    stop();
    moveTo(0);
    await baseline();
    await baseline();
    expect(onMove).not.toHaveBeenCalled();
  });
});
