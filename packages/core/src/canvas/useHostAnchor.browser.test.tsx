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
afterEach(() => {
  root?.unmount();
  page?.remove();
  root = null;
  page = null;
});

function Panel({ host }: { host: Element }) {
  const { ref, style } = useHostAnchor(() => host, { align: { x: 'start', y: 'start' }, offset: { x: 0, y: 0 } });
  return <div ref={ref} data-testid="panel" style={{ position: 'fixed', width: 10, height: 10, ...style }} />;
}

function mount(): { sibling: HTMLDivElement; host: HTMLDivElement; panelTop: () => number } {
  page = document.createElement('div');
  page.innerHTML =
    '<div style="height:80px"></div><div style="width:200px;height:100px"></div><div></div>';
  document.body.appendChild(page);
  const [sibling, host, mountPoint] = [...page.children] as HTMLDivElement[];
  root = createRoot(mountPoint);
  flushSync(() => root!.render(createElement(Panel, { host })));
  return {
    sibling,
    host,
    panelTop: () => page!.querySelector<HTMLElement>('[data-testid="panel"]')!.getBoundingClientRect().top,
  };
}

describe('useHostAnchor', () => {
  it('follows a host that a collapsing sibling moves', async () => {
    const { sibling, host, panelTop } = mount();
    const hostTop = () => Math.round(host.getBoundingClientRect().top);
    await expect.poll(() => Math.round(panelTop())).toBe(hostTop());

    const before = hostTop();
    sibling.style.height = '0px';
    expect(hostTop()).toBe(before - 80);
    await expect.poll(() => Math.round(panelTop())).toBe(before - 80);
  });

  it('keeps following through a second move', async () => {
    const { sibling, host, panelTop } = mount();
    const hostTop = () => Math.round(host.getBoundingClientRect().top);
    const start = hostTop();
    sibling.style.height = '0px';
    await expect.poll(() => Math.round(panelTop())).toBe(start - 80);
    sibling.style.height = '140px';
    await expect.poll(() => Math.round(panelTop())).toBe(start + 60);
  });
});
