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

/** One step of a real mouse: a move to a client point of the test's frame, a
 *  press, or a release of the primary button. */
export type PointerStep = { to: [x: number, y: number] } | { down: true } | { up: true };

type CommandContext = Parameters<BrowserCommand<[]>>[0];

/** Maps a client point of the test's frame to the page point the mouse moves to. */
async function frameToPage(ctx: CommandContext): Promise<(at: [number, number]) => [number, number]> {
  const frame = await ctx.frame();
  const element = await frame.frameElement();
  const box = await element.boundingBox();
  if (!box) throw new Error('the test frame has no box');
  // The orchestrator may scale the frame to fit; its client box is the unscaled one.
  const [width, left, top] = await element.evaluate(
    (el) => {
      const box = el as HTMLElement;
      return [box.clientWidth, box.clientLeft, box.clientTop] as const;
    },
  );
  const scale = box.width / (width + 2 * left);
  return ([x, y]) => [box.x + (left + x) * scale, box.y + (top + y) * scale];
}

/** Drive the real mouse through `steps`, as a person would: each move is one
 *  trusted `mousemove` and its pointer events, with the button state the steps
 *  before it left. */
const pointer: BrowserCommand<[steps: PointerStep[]]> = async (ctx, steps) => {
  const toPage = await frameToPage(ctx);
  for (const step of steps) {
    if ('to' in step) await ctx.page.mouse.move(...toPage(step.to));
    else if ('down' in step) await ctx.page.mouse.down();
    else await ctx.page.mouse.up();
  }
};

/** Two clicks at a client point of the test's frame, the second sent while the
 *  page's main thread is busy for `stallMs`: it happens on time and is handled
 *  once the stall ends. */
const clickAcrossStall: BrowserCommand<[at: [number, number], stallMs: number]> = async (ctx, at, stallMs) => {
  const [x, y] = (await frameToPage(ctx))(at);
  const frame = await ctx.frame();
  const cdp = await ctx.page.context().newCDPSession(ctx.page);
  try {
    await ctx.page.mouse.click(x, y);
    await frame.evaluate((ms) => {
      setTimeout(() => {
        const end = performance.now() + ms;
        while (performance.now() < end) { /* the long task */ }
      }, 0);
    }, stallMs);
    await new Promise((r) => setTimeout(r, 50));
    // Sent together rather than each once the last is handled, so both queue behind the stall.
    const button = { x, y, button: 'left', clickCount: 1 } as const;
    await Promise.all([
      cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', buttons: 1, ...button }),
      cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', buttons: 0, ...button }),
    ]);
  } finally {
    await cdp.detach();
  }
};

export const browserCommands = {
  grantClipboard, holdClipboard, dropClipboard, armDownload, takeDownload, collectGarbage, settleFrame,
  pointer, clickAcrossStall,
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
    pointer: (steps: PointerStep[]) => Promise<void>;
    clickAcrossStall: (at: [x: number, y: number], stallMs: number) => Promise<void>;
  }
}
