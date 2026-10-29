/**
 * WeaselDraw's context menus in the whole editor, mounted under StrictMode the way `main.tsx`
 * mounts it: jsdom never mounts the canvas, because the workspace measures zero there.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ActionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import '@weasel-js/theme/tokens.css';
import { App } from './App';
import { LS_KEY } from './sceneLoading';
import { withIcons as WithIcons } from './testIcons';

let root: Root | null = null;
let mountPoint: HTMLDivElement | null = null;

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  root?.unmount();
  mountPoint?.remove();
  root = null;
  mountPoint = null;
  localStorage.clear();
});

async function mountApp(): Promise<{ host: HTMLElement; canvas: HTMLCanvasElement }> {
  mountPoint = document.createElement('div');
  document.body.style.margin = '0';
  document.body.appendChild(mountPoint);
  root = createRoot(mountPoint);
  root.render(
    <StrictMode>
      <WithIcons>
        <DepRegistryProvider>
          <ActionsProvider>
            <SelectionContextProvider>
              <App />
            </SelectionContextProvider>
          </ActionsProvider>
        </DepRegistryProvider>
      </WithIcons>
    </StrictMode>,
  );
  await expect.poll(() => document.querySelector('.wd-canvas-host canvas')).not.toBeNull();
  const host = document.querySelector<HTMLElement>('.wd-canvas-host')!;
  return { host, canvas: host.querySelector('canvas')! };
}

/** A world point on the letter page fitted to the workspace with 24px of padding. The starter
 *  rect spans world (80, 80) to (240, 180). */
function pagePoint(host: HTMLElement, wx: number, wy: number): { x: number; y: number } {
  const box = host.getBoundingClientRect();
  const scale = Math.min((box.width - 48) / 816, (box.height - 48) / 1056);
  return {
    x: box.left + box.width / 2 + (wx - 816 / 2) * scale,
    y: box.top + box.height / 2 + (wy - 1056 / 2) * scale,
  };
}

function rightClick(target: Element, at: { x: number; y: number }): void {
  const init = { bubbles: true, cancelable: true, button: 2, clientX: at.x, clientY: at.y };
  target.dispatchEvent(new MouseEvent('contextmenu', init));
}

const menuItems = (): string[] =>
  Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"]')).map((el) => el.textContent ?? '');

/** Each row's label, without the shortcut after it: `⌘X` on a Mac, `Ctrl+X` elsewhere. */
const menuLabels = (): string[] =>
  Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"]'))
    .map((el) => el.querySelector(':scope > span:not([aria-hidden])')?.textContent ?? '');

const menuItem = (label: string): HTMLElement | undefined =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]'))
    .find((el) => el.textContent?.includes(label));

const savedNodeCount = (): number =>
  (JSON.parse(localStorage.getItem(LS_KEY) ?? '{"nodes":[]}') as { nodes: unknown[] }).nodes.length;

describe('WeaselDraw context menus', () => {
  it('duplicates the shape from its menu', async () => {
    const { host, canvas } = await mountApp();
    await expect.poll(savedNodeCount).toBe(1);
    rightClick(canvas, pagePoint(host, 160, 130));
    await expect.poll(() => menuItem('Duplicate')).toBeDefined();
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
    // An id draw does not register drops out of the menu silently.
    expect(menuLabels()).toEqual([
      'Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Group', 'Ungroup',
      'Bring Forward', 'Bring to Front', 'Send Backward', 'Send to Back', 'Edit path anchors', 'Enter text edit',
    ]);
    menuItem('Duplicate')!.click();
    await expect.poll(savedNodeCount).toBe(2);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('offers Paste and Select All on the empty page', async () => {
    const { host, canvas } = await mountApp();
    rightClick(canvas, pagePoint(host, 600, 800));
    await expect.poll(menuItems).toEqual(expect.arrayContaining([
      expect.stringContaining('Paste'), expect.stringContaining('Select All'),
    ]));
    expect(menuItem('Duplicate')).toBeUndefined();
  });

  it('opens the row menu on a layer row and selects that row', async () => {
    await mountApp();
    const firstRow = () => document.querySelector<HTMLElement>('.wd-sidebar.right [role="row"]');
    await expect.poll(firstRow).not.toBeNull();
    const row = firstRow()!;
    const box = row.getBoundingClientRect();
    rightClick(row, { x: box.left + 10, y: box.top + box.height / 2 });
    await expect.poll(() => menuItem('Duplicate')).toBeDefined();
    await expect.poll(() => document.querySelector('.wd-statusbar')?.textContent ?? '').toContain('sel: 1');
  });
});
