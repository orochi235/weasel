import type { BrowserCommand } from 'vitest/node';
import type {} from '@vitest/browser-playwright';
import type { Download } from '@playwright/test';

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

export const browserCommands = { grantClipboard, armDownload, takeDownload };

declare module 'vitest/browser' {
  interface BrowserCommands {
    grantClipboard: () => Promise<void>;
    armDownload: (timeoutMs: number) => Promise<void>;
    takeDownload: () => Promise<{ filename: string; text: string } | null>;
  }
}
