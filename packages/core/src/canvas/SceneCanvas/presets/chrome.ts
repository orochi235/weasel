import type { ChromeId } from 'domains/chrome-caps/types';

/** The selection chrome each core preset owns. Apart from the presets, so
 *  hiding a preset's chrome does not load its actions. */
export const PRESET_CHROME = {
  outline: ['selection.outline'],
  resize: ['selection.resize-handles'],
  rotate: ['selection.rotation-handle'],
} as const satisfies Record<string, readonly ChromeId[]>;

/** Every chrome id a core preset owns. */
export const PRESET_OWNED_CHROME: readonly ChromeId[] = Object.values(PRESET_CHROME).flat();
