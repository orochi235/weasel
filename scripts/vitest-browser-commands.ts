import type { BrowserCommand } from 'vitest/node';
import type {} from '@vitest/browser-playwright';
import type { Download } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { holdMachineLock } from './machine-lock.ts';

// Server-side commands for the `browser` vitest project, reached from a test
// through `commands` in 'vitest/browser'. They run against the Playwright
// page and context the test's iframe lives in.

const downloads = new Map<string, Promise<Download | null>>();

// Headless Chromium reads and writes the machine's one clipboard, so two test
// files using it at once, or two runs on one machine, read each other's text.
const CLIPBOARD_LOCK = join(tmpdir(), 'weasel-test-clipboard.lock');
const clipboardHeld = new Map<string, () => void>();

/** Take the machine's clipboard for this test file, waiting for whoever has
 *  it, and grant the page clipboard read and write. `releaseClipboard` gives it back. */
const holdClipboard: BrowserCommand<[]> = async (ctx) => {
  if (!clipboardHeld.has(ctx.sessionId)) clipboardHeld.set(ctx.sessionId, await holdMachineLock(CLIPBOARD_LOCK));
  await ctx.context.grantPermissions(['clipboard-read', 'clipboard-write']);
};

const releaseClipboard: BrowserCommand<[]> = async (ctx) => {
  clipboardHeld.get(ctx.sessionId)?.();
  clipboardHeld.delete(ctx.sessionId);
};

/** Start listening for the page's next download. Call before the action that
 *  triggers it; `takeDownload` collects it. */
const armDownload: BrowserCommand<[timeoutMs: number]> = async (ctx, timeoutMs) => {
  downloads.set(
    ctx.sessionId,
    ctx.page.waitForEvent('download', { timeout: timeoutMs }).catch(() => null),
  );
};

/** The download `armDownload` waited for, or null if none arrived in time. */
const takeDownload: BrowserCommand<[]> = async (ctx) => {
  const pending = downloads.get(ctx.sessionId);
  downloads.delete(ctx.sessionId);
  const download = await pending;
  if (!download) return null;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  await download.delete();
  return { filename: download.suggestedFilename(), text };
};

export const browserCommands = { holdClipboard, releaseClipboard, armDownload, takeDownload };

declare module 'vitest/browser' {
  interface BrowserCommands {
    holdClipboard: () => Promise<void>;
    releaseClipboard: () => Promise<void>;
    armDownload: (timeoutMs: number) => Promise<void>;
    takeDownload: () => Promise<{ filename: string; text: string } | null>;
  }
}
