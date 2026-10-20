import { expect } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { ActionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { iconsWrapper } from '@weasel-js/ui/testing/withIcons';
import { App } from '../App';
import { chartPrefs } from '../prefs';

const WithIcons = iconsWrapper();
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
  // The page is fitted on the first measured size; wait for that frame.
  await new Promise((r) => setTimeout(r, 100));
  return { host, canvas: host.querySelector('canvas')! };
}

export function unmountChartApp(): void {
  root?.unmount();
  mountPoint?.remove();
  // The store caches what it read, so clearing storage alone would leak prefs into the next test.
  chartPrefs().reset();
  root = null;
  mountPoint = null;
}
