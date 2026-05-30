/**
 * Storybook preset for the Secondary Panel addon.
 *
 * Manager-only — registers a toolbar button and a fixed right-side panel
 * slot that mirrors any registered addon panel's render(). Lets you view
 * two addon panels at once (e.g. Controls + CSS Vars) without tab toggling.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const managerEntries = async (entry: string[] = []): Promise<string[]> => [
  ...entry,
  resolve(here, 'manager.tsx'),
];
