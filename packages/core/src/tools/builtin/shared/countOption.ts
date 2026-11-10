import { setToolOption, steppedOption, toolOptionNumberLeaf, toolOptionParams, type ToolOptions, type ToolOptionValues } from '@weasel-js/routing';

/** Step `toolId`'s count option `option` by one, up or down as `params` say: a key binding's `delta`, or a wheel's
 *  `deltaY`, where up (deltaY > 0 under natural scrolling) adds one. Held to the leaf's bounds. Returns whether it
 *  moved anything. */
export function stepCountOption(
  toolId: string,
  options: ToolOptions,
  option: string,
  values: ToolOptionValues | undefined,
  params: Readonly<Record<string, unknown>> | undefined,
): boolean {
  const leaf = toolOptionNumberLeaf(options, option);
  const p = params as { deltaY?: number; delta?: number } | undefined;
  const step = p?.delta ?? (p?.deltaY ? Math.sign(p.deltaY) : 0);
  if (!values || !leaf || step === 0) return false;
  const current = toolOptionParams(toolId, options, values)[option];
  const from = typeof current === 'number' ? current : leaf.default ?? 0;
  const next = steppedOption(leaf, from, { option, plus: 1 }, step > 0 ? 1 : -1);
  if (next === from) return false;
  setToolOption(toolId, options, values, option, next);
  return true;
}
