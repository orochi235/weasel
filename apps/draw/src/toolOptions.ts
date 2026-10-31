import type { ToolOptionValues } from '@weasel-js/core';
import { drawPrefs, type DrawPrefPath } from './prefs';

const NONE: Readonly<Record<string, number>> = Object.freeze({});
const pathOf = (toolId: string, option: string) => `tools.${toolId}.${option}` as DrawPrefPath;

/** Draw's tool option values: each a pref under `tools.<tool id>`, so they persist per tool. */
export function drawToolOptionValues(prefs = drawPrefs()): ToolOptionValues {
  return {
    get(toolId) {
      const held = (prefs.values() as { tools?: Record<string, unknown> }).tools?.[toolId];
      return (held && typeof held === 'object' ? held : NONE) as Record<string, number>;
    },
    set: (toolId, option, value) => prefs.set(pathOf(toolId, option), value as never),
    subscribe: (listener) => prefs.subscribe(() => listener()),
  };
}
