/**
 * `useClipboardOps().copy()` against Chromium's real async Clipboard API: a
 * flavor given as a promise that settles well after the click still reaches
 * the OS clipboard, `web `-prefixed custom types included, and a flavor that
 * rejects costs only itself.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { InsertAdapter } from 'core/adapters/types';
import { asNodeId } from 'core/scene/types';
import { useClipboardOps, type ClipboardFlavors } from './clipboardOps';
import { WEASEL_CLIPBOARD_MIME } from './wireFormat';

interface Obj { id: string }

const adapter: InsertAdapter<Obj> = {
  commitInsert: () => null,
  commitPaste: () => [],
  snapshotSelection: (ids) => ({ items: ids.map((id) => ({ id })) }),
  getPasteOffset: () => ({ dx: 0, dy: 0 }),
  insertNode: () => {},
  setSelection: () => {},
  getSelection: () => ['a'],
  applyOps: () => {},
};

function CopyButton({ flavors }: { flavors: () => ClipboardFlavors }) {
  const { copy } = useClipboardOps(adapter, {
    getSelection: () => [asNodeId('a')],
    produceFlavors: flavors,
  });
  return createElement('button', { type: 'button', onClick: copy }, 'copy');
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function clickCopy(flavors: () => ClipboardFlavors): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(CopyButton, { flavors })));
  await userEvent.click(page.getByRole('button', { name: 'copy' }));
}

/** Every type on the clipboard, mapped to its text. */
async function readClipboard(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const item of await navigator.clipboard.read()) {
    for (const type of item.types) out[type] = await (await item.getType(type)).text();
  }
  return out;
}

function after(ms: number, text: string): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(text), ms));
}

function failAfter(ms: number): Promise<string> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('export failed')), ms));
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const JSON_TEXT = '{"weaselClipboard":1,"nodes":[{"id":"a"}]}';

beforeAll(async () => {
  await commands.grantClipboard();
});

afterEach(async () => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  await navigator.clipboard.writeText('sentinel');
});

describe('useClipboardOps copy, real Chromium clipboard', () => {
  it.each([200, 2000])('writes a promised SVG flavor that settles %dms after the click', async (ms) => {
    await clickCopy(() => ({
      [WEASEL_CLIPBOARD_MIME]: JSON_TEXT,
      'image/svg+xml': after(ms, SVG),
      'text/plain': after(ms, SVG),
    }));
    await vi.waitFor(async () => expect((await readClipboard())['text/plain']).toBe(SVG), { timeout: ms + 3000 });
    expect(await readClipboard()).toEqual({
      'text/plain': SVG,
      [`web ${WEASEL_CLIPBOARD_MIME}`]: JSON_TEXT,
      'web image/svg+xml': SVG,
    });
  });

  it('drops a custom flavor that rejects and still writes every other flavor', async () => {
    await clickCopy(() => ({
      [WEASEL_CLIPBOARD_MIME]: JSON_TEXT,
      'image/svg+xml': failAfter(200),
      'text/plain': 'plain',
    }));
    await vi.waitFor(async () => expect((await readClipboard())['text/plain']).toBe('plain'), { timeout: 3000 });
    expect(await readClipboard()).toEqual({
      'text/plain': 'plain',
      [`web ${WEASEL_CLIPBOARD_MIME}`]: JSON_TEXT,
    });
  });

  it('drops a well-known flavor that rejects and still writes the custom ones', async () => {
    await clickCopy(() => ({
      [WEASEL_CLIPBOARD_MIME]: JSON_TEXT,
      'image/svg+xml': SVG,
      'text/plain': failAfter(200),
    }));
    await vi.waitFor(
      async () => expect((await readClipboard())[`web ${WEASEL_CLIPBOARD_MIME}`]).toBe(JSON_TEXT),
      { timeout: 3000 },
    );
    expect(await readClipboard()).toEqual({
      [`web ${WEASEL_CLIPBOARD_MIME}`]: JSON_TEXT,
      'web image/svg+xml': SVG,
    });
  });

  it('leaves the previous clipboard whole when every flavor rejects', async () => {
    await clickCopy(() => ({ 'text/plain': 'before' }));
    await vi.waitFor(async () => expect((await readClipboard())['text/plain']).toBe('before'), { timeout: 3000 });
    root!.unmount();
    host!.remove();
    await clickCopy(() => ({ [WEASEL_CLIPBOARD_MIME]: failAfter(100), 'text/plain': failAfter(200) }));
    await new Promise((r) => setTimeout(r, 800));
    expect(await readClipboard()).toEqual({ 'text/plain': 'before' });
  });
});
