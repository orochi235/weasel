import { describe, it, expect, afterEach, vi } from 'vitest';
import { watchElementMove } from './watchElementMove';

let page: HTMLDivElement | null = null;
let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  page?.remove();
  page = null;
  stop = undefined;
});

function mount(): { sibling: HTMLDivElement; host: HTMLDivElement } {
  page = document.createElement('div');
  page.innerHTML = '<div style="height:80px"></div><div style="width:200px;height:100px"></div>';
  document.body.appendChild(page);
  const [sibling, host] = [...page.children] as HTMLDivElement[];
  return { sibling, host };
}

describe('watchElementMove', () => {
  it('reports a move made before the observer first reported', async () => {
    const { sibling, host } = mount();
    const onMove = vi.fn();
    stop = watchElementMove(host, onMove);
    sibling.style.height = '0px';
    await expect.poll(() => onMove.mock.calls.length).toBeGreaterThan(0);
  });

  it('reports a second move made as the first is reported', async () => {
    const { sibling, host } = mount();
    const tops: number[] = [];
    stop = watchElementMove(host, () => {
      tops.push(host.getBoundingClientRect().top);
      if (tops.length === 1) queueMicrotask(() => { sibling.style.height = '140px'; });
    });
    const start = host.getBoundingClientRect().top;
    sibling.style.height = '0px';
    await expect.poll(() => tops.at(-1)).toBe(start + 60);
  });

  it('stays quiet while the element holds still', async () => {
    const { host } = mount();
    const onMove = vi.fn();
    stop = watchElementMove(host, onMove);
    await new Promise((r) => setTimeout(r, 300));
    expect(onMove).not.toHaveBeenCalled();
  });
});
