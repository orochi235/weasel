/**
 * A host that moves without changing size: jsdom lays nothing out, so only a
 * browser can say whether the panel went with it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useHostAnchor } from './useHostAnchor';

let root: Root | null = null;
let page: HTMLDivElement | null = null;
const unmount = () => {
  root?.unmount();
  page?.remove();
  root = null;
  page = null;
};
afterEach(unmount);

function Panel({ host }: { host: Element }) {
  const { ref, style } = useHostAnchor(() => host, { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } });
  return <div ref={ref} data-testid="panel" style={{ position: 'fixed', width: 10, height: 10, ...style }} />;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mount(): { sibling: HTMLDivElement; host: HTMLDivElement; following: () => Promise<void> } {
  page = document.createElement('div');
  page.innerHTML =
    '<div style="height:80px"></div><div style="width:200px;height:100px"></div><div></div>';
  document.body.appendChild(page);
  const [sibling, host, mountPoint] = [...page.children] as HTMLDivElement[];
  root = createRoot(mountPoint);
  flushSync(() => root!.render(createElement(Panel, { host })));
  const gap = () =>
    page!.querySelector<HTMLElement>('[data-testid="panel"]')!.getBoundingClientRect().top - host.getBoundingClientRect().top;
  return {
    sibling,
    host,
    // The panel moves a frame or more after the host does, so its position is waited on, never read once.
    following: () => expect.poll(gap).toBeCloseTo(0, 0),
  };
}

describe('useHostAnchor', () => {
  it('follows a host that a collapsing sibling moves', async () => {
    const { sibling, host, following } = mount();
    await following();

    const before = host.getBoundingClientRect().top;
    sibling.style.height = '0px';
    expect(host.getBoundingClientRect().top).toBeCloseTo(before - 80, 0);
    await following();
  });

  it('keeps following through a second move', async () => {
    const { sibling, following } = mount();
    await following();
    sibling.style.height = '0px';
    await following();
    sibling.style.height = '140px';
    await following();
  });

  it('ends on the host after a burst of moves closer together than frames', async () => {
    for (let round = 0; round < 8; round++) {
      const { sibling, following } = mount();
      await wait(round * 9);
      for (const [height, gap] of [[0, 7], [140, 31], [30, 3], [200, 19], [0, 43], [80, 11]]) {
        sibling.style.height = `${height}px`;
        await wait(gap + round * 5);
      }
      await following();
      unmount();
    }
  });
});
