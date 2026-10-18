import type { BrowserCommand } from 'vitest/node';
import type {} from '@vitest/browser-playwright';
import type { Download } from '@playwright/test';
import { createServer, type Server } from 'node:net';
import { waitForOwnFrame } from './vitest-own-frame.ts';

// Server-side commands for the `browser` vitest project, reached from a test
// through `commands` in 'vitest/browser'. They run against the Playwright
// page and context the test's iframe lives in.

const downloads = new Map<string, Promise<Download | null>>();

/** Grant clipboard read and write to the test page's origin. */
const grantClipboard: BrowserCommand<[]> = async (ctx) => {
  await ctx.context.grantPermissions(['clipboard-read', 'clipboard-write']);
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

// Test files share the real clipboard, so a test that uses it holds this port while it does.
// A port, not a file: it holds off a second run on the machine too, and is freed when a run dies.
const CLIPBOARD_PORT = 47_611;
const clipboardHolds = new Map<string, Server>();

const listenOnce = (): Promise<Server | null> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (err: NodeJS.ErrnoException) =>
      err.code === 'EADDRINUSE' ? resolve(null) : reject(err));
    server.listen(CLIPBOARD_PORT, '127.0.0.1', () => resolve(server));
  });

/** Take the machine's clipboard for this test, waiting for any other test that has it.
 *  `dropClipboard` gives it back. */
const holdClipboard: BrowserCommand<[timeoutMs: number]> = async (ctx, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const server = await listenOnce();
    if (server) {
      clipboardHolds.set(ctx.sessionId, server);
      return;
    }
    if (Date.now() > deadline) throw new Error(`the clipboard was held for ${timeoutMs} ms (port ${CLIPBOARD_PORT})`);
    await new Promise((r) => setTimeout(r, 25));
  }
};

const dropClipboard: BrowserCommand<[]> = async (ctx) => {
  const server = clipboardHolds.get(ctx.sessionId);
  clipboardHolds.delete(ctx.sessionId);
  if (server) await new Promise((r) => server.close(r));
};

/** Run a full garbage collection in the renderer the test page lives in. */
const collectGarbage: BrowserCommand<[]> = async (ctx) => {
  const cdp = await ctx.page.context().newCDPSession(ctx.page);
  try {
    await cdp.send('HeapProfiler.collectGarbage');
  } finally {
    await cdp.detach();
  }
};

/** Wait until vitest's own commands, `userEvent.keyboard` among them, find this file's frame. */
const settleFrame: BrowserCommand<[]> = async (ctx) => {
  if (ctx.testPath) await waitForOwnFrame(ctx.page, ctx.testPath);
};

export const browserCommands = {
  grantClipboard, holdClipboard, dropClipboard, armDownload, takeDownload, collectGarbage, settleFrame,
};

declare module 'vitest/browser' {
  interface BrowserCommands {
    grantClipboard: () => Promise<void>;
    holdClipboard: (timeoutMs: number) => Promise<void>;
    dropClipboard: () => Promise<void>;
    armDownload: (timeoutMs: number) => Promise<void>;
    takeDownload: () => Promise<{ filename: string; text: string } | null>;
    collectGarbage: () => Promise<void>;
    settleFrame: () => Promise<void>;
  }
}
