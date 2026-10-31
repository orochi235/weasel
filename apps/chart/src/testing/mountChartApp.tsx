import { expect } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { ActionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { App } from '../App';
import { chartPrefs } from '../prefs';
import { withIcons as WithIcons } from '../testIcons';
import { frames } from './pointer';

let root: Root | null = null;
let mountPoint: HTMLDivElement | null = null;

/** Mounts the whole app full-window, as `main.tsx` does, and waits for its canvas. */
export async function mountChartApp(): Promise<{ host: HTMLElement; canvas: HTMLCanvasElement }> {
  mountPoint = document.createElement('div');
  mountPoint.style.width = '100vw';
  mountPoint.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.appendChild(mountPoint);
  root = createRoot(mountPoint);
  root.render(
    <WithIcons>
      <DepRegistryProvider>
        <ActionsProvider>
          <SelectionContextProvider>
            <App />
          </SelectionContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>
    </WithIcons>,
  );
  await expect.poll(() => document.querySelector('.wc-host canvas')).not.toBeNull();
  const host = document.querySelector<HTMLElement>('.wc-host')!;
  await canvasSettled(host);
  return { host, canvas: host.querySelector('canvas')! };
}

/**
 * Waits until the workspace's canvas has caught up with the host's layout, then for the frames that refit and draw
 * it. The host shrinks once the toolbar's palette fills in, but the canvas learns that from a `ResizeObserver`,
 * which a long first frame can hold back past any fixed wait.
 */
export async function canvasSettled(host: HTMLElement): Promise<void> {
  await expect.poll(() => {
    const canvas = host.querySelector('canvas')?.getBoundingClientRect();
    const box = host.getBoundingClientRect();
    return canvas !== undefined && Math.abs(canvas.width - box.width) < 0.5 && Math.abs(canvas.height - box.height) < 0.5;
  }).toBe(true);
  await frames(2);
}

export function unmountChartApp(): void {
  root?.unmount();
  mountPoint?.remove();
  // The store caches what it read, so clearing storage alone would leak prefs into the next test.
  chartPrefs().reset();
  root = null;
  mountPoint = null;
}
