/**
 * The whole editor in a real browser: jsdom never mounts its canvas, because the workspace
 * measures zero there.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createRoot, type Root } from 'react-dom/client';
import { ActionsProvider, DepRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import '@weasel-js/theme/tokens.css';
import { App } from './App';
import { DOC_KEY } from './docPersistence';
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
  await expect.poll(() => document.querySelector('.wd-canvas-host canvas')).not.toBeNull();
  const host = document.querySelector<HTMLElement>('.wd-canvas-host')!;
  return { host, canvas: host.querySelector('canvas')! };
}

/** The starter rect sits at world (80, 80) to (240, 180) on a letter page fitted to the
 *  workspace with 24px of padding. */
function starterCenter(host: HTMLElement): { x: number; y: number } {
  const box = host.getBoundingClientRect();
  const scale = Math.min((box.width - 48) / 816, (box.height - 48) / 1056);
  return {
    x: box.left + box.width / 2 + (160 - 816 / 2) * scale,
    y: box.top + box.height / 2 + (130 - 1056 / 2) * scale,
  };
}

function press(canvas: Element, type: string, at: { x: number; y: number }, detail = 1): void {
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: at.x, clientY: at.y, detail,
  }));
}

function click(canvas: Element, at: { x: number; y: number }): void {
  press(canvas, 'pointerdown', at);
  press(canvas, 'pointerup', at);
  canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: at.x, clientY: at.y }));
}

function doubleClick(canvas: Element, at: { x: number; y: number }): void {
  click(canvas, at);
  click(canvas, at);
  canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: at.x, clientY: at.y, detail: 2 }));
}

const key = (k: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
};

/** Replaces the starter rect with a text node in the same box. */
function seedText(): void {
  localStorage.setItem(LS_KEY, JSON.stringify({
    version: 2,
    nodes: [{
      id: 'starter-1', kind: 'mark', layer: 'default', parent: null,
      pose: { x: 80, y: 80, width: 160, height: 100 },
      data: { text: 'Hello', style: { fontSize: 48 } },
    }],
  }));
}

const editor = (): Element | null => document.querySelector('.wd-canvas-host [contenteditable="true"]');

const statusText = (): string => document.querySelector('.wd-statusbar')?.textContent ?? '';

/** The menu bar leads the command bar's first line, the command bar is the top row, and the page neither grows
 *  nor scrolls. */
function expectMenuBarLeadsCommandBar(): void {
  const menus = document.querySelector('[role="menubar"]')!.getBoundingClientRect();
  const commands = document.querySelector('.wd-commandbar')!.getBoundingClientRect();
  const file = document.querySelector('.wd-commandbar-group')!.getBoundingClientRect();
  expect(commands.top).toBe(0);
  expect(menus.height).toBeGreaterThan(0);
  expect(menus.top).toBeGreaterThanOrEqual(commands.top);
  expect(menus.bottom).toBeLessThanOrEqual(commands.bottom + 0.5);
  // On the first line, beside the File buttons rather than above them.
  expect(menus.right).toBeLessThanOrEqual(file.left + 0.5);
  expect(menus.bottom).toBeGreaterThan(file.top);
  expect(menus.top).toBeLessThan(file.bottom);
  expect(document.querySelector('.wd-app')!.getBoundingClientRect().height).toBe(window.innerHeight);
  expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
  window.scrollTo(0, 5000);
  expect(window.scrollY).toBe(0);
}

const menuRows = (): string[] =>
  [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((el) => el.textContent ?? '');

describe('WeaselDraw', () => {
  it('draws the menu bar at the start of the command bar, on one row, and the page does not scroll', async () => {
    await mountApp();
    expectMenuBarLeadsCommandBar();
  });

  it('keeps the menu bar leading the command bar at 640px wide', async () => {
    await page.viewport(640, 800);
    await mountApp();
    expectMenuBarLeadsCommandBar();
  });

  it('opens File from its title, with Save showing its shortcut', async () => {
    await mountApp();
    await userEvent.click(page.getByRole('menuitem', { name: 'File' }));
    await expect.poll(menuRows).toHaveLength(5);
    const rows = menuRows();
    ['New', 'Open…', 'Import…', 'Save', 'Export Page as SVG…'].forEach((label, i) => expect(rows[i]!.startsWith(label)).toBe(true));
    expect(rows[3]).toMatch(/S$/);
    expect(rows[3]).not.toBe('Save');
  });

  it('sizes the canvas to the workspace between the sidebars', async () => {
    const { host, canvas } = await mountApp();
    const hostBox = host.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    expect(hostBox.width).toBeGreaterThan(200);
    expect(hostBox.height).toBeGreaterThan(200);
    expect(Math.round(canvasBox.width)).toBe(Math.round(hostBox.width));
    expect(Math.round(canvasBox.height)).toBe(Math.round(hostBox.height));
    expect(host.dataset.mode).toBe('normal');
  });

  it('saves the scene and the document to local storage', async () => {
    await mountApp();
    await expect.poll(() => localStorage.getItem(LS_KEY)).toContain('starter-1');
    await expect.poll(() => localStorage.getItem(LS_KEY)).toContain('core:pages');
    await expect.poll(() => localStorage.getItem(DOC_KEY)).toContain('untitled.svg');
  });

  it('selects the starter rect on a click', async () => {
    const { host, canvas } = await mountApp();
    click(canvas, starterCenter(host));
    await expect.poll(statusText).toContain('sel: 1');
  });

  it('enters path-edit on a double-click of a path, and leaves it on Escape', async () => {
    const { host, canvas } = await mountApp();
    doubleClick(canvas, starterCenter(host));
    await expect.poll(() => host.dataset.mode).toBe('path-edit');
    key('Escape');
    await expect.poll(() => host.dataset.mode).toBe('normal');
  });

  it('leaves text-edit when Escape ends the edit', async () => {
    seedText();
    const { host, canvas } = await mountApp();
    doubleClick(canvas, starterCenter(host));
    await expect.poll(() => host.dataset.mode).toBe('text-edit');
    await expect.poll(editor).not.toBeNull();
    editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect.poll(editor).toBeNull();
    await expect.poll(() => host.dataset.mode).toBe('normal');
  });

  it('closes the editor when the breadcrumb leaves text-edit', async () => {
    seedText();
    const { host, canvas } = await mountApp();
    doubleClick(canvas, starterCenter(host));
    await expect.poll(editor).not.toBeNull();
    await expect.poll(() => host.dataset.mode).toBe('text-edit');
    const exit = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Exit');
    exit!.click();
    await expect.poll(() => host.dataset.mode).toBe('normal');
    await expect.poll(editor).toBeNull();
  });
});

const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.wd-pages [role="tab"]')];
const lit = (): number => tabs().findIndex((t) => t.getAttribute('aria-selected') === 'true');
const savedPageIds = (): string[] | undefined =>
  (JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as { doc?: { 'core:pages'?: { pages: { id: string }[] } } })
    .doc?.['core:pages']?.pages.map((p) => p.id);

describe('WeaselDraw pages', () => {
  it('puts the page tabs under the workspace, across its width', async () => {
    const { host } = await mountApp();
    const strip = document.querySelector('.wd-pages')!.getBoundingClientRect();
    const box = host.getBoundingClientRect();
    expect(strip.top).toBeCloseTo(box.bottom, 0);
    expect(strip.left).toBeCloseTo(box.left, 0);
    expect(strip.width).toBeCloseTo(box.width, 0);
    expect(box.height).toBeGreaterThan(400);
    expect(tabs().map((t) => t.textContent)).toEqual(['Page 1']);
  });

  it('adds a page and goes to it, keeps it through a reload, and steps back on Page Up', async () => {
    await mountApp();
    await userEvent.click(page.getByRole('button', { name: 'Add page' }));
    await expect.poll(() => tabs().length).toBe(2);
    await expect.poll(lit).toBe(1);
    await expect.poll(savedPageIds).toEqual(['page-1', 'page-2']);
    root?.unmount();
    mountPoint?.remove();
    await mountApp();
    expect(tabs()).toHaveLength(2);
    await expect.poll(lit).toBe(0);
    key('PageDown');
    await expect.poll(lit).toBe(1);
    key('PageUp');
    await expect.poll(lit).toBe(0);
  });
});
