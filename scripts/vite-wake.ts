import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

/**
 * vite-plugin-wake from this machine's checkout of it, or no plugin where there is none. It is not
 * published, so CI and a fresh clone must build without it.
 */
export async function localWake(): Promise<Plugin | null> {
  const entry = process.env.WAKE_PATH ?? join(homedir(), 'src/wake/dist/index.js');
  if (!existsSync(entry)) {
    if (!process.env.CI) console.warn(`wake: ${entry} not found; serving without one-copy-per-app`);
    return null;
  }
  const { wake } = (await import(pathToFileURL(resolve(entry)).href)) as { wake: () => Plugin };
  return wake();
}
