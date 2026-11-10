import { prefsToolOptionValues, type ToolOptionPrefsStore, type ToolOptionValues } from '@weasel-js/core';
import { drawPrefs } from './prefs';

let held: { store: unknown; values: ToolOptionValues } | null = null;

/** Draw's tool option values: each a pref under `tools.<owner>`, so they persist. One store per prefs store. */
export function drawToolOptionValues(prefs = drawPrefs()): ToolOptionValues {
  if (held?.store !== prefs) held = { store: prefs, values: prefsToolOptionValues(prefs as ToolOptionPrefsStore, 'tools') };
  return held.values;
}
