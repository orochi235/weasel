/**
 * The style armed at a collapsed caret for the next character, kept as the change it makes to the styling the
 * caret sits in: a key it sets, and a key it takes off as `false` (a flag) or `undefined`. So a shortcut can take
 * bold off at the end of a bold word, and the character typed next lands as a write of the same patch over it would.
 */
import {
  applyStyleToRange, patchRangeStyle, type RangeStyle, type RunStylePatch,
} from '@weasel-js/text';

const FLAGS: ReadonlySet<string> = new Set(['bold', 'italic', 'underline', 'strikethrough', 'overline']);

/** `style` with `armed` laid over it, as the next character takes them. */
export function withArmed(style: RunStylePatch, armed: RunStylePatch): RunStylePatch {
  const out: Record<string, unknown> = { ...style };
  for (const [key, value] of Object.entries(armed)) {
    if (value === undefined || value === false) delete out[key];
    else out[key] = value;
  }
  return out as RunStylePatch;
}

/**
 * The armed style after `patch` is armed over `armed` at a caret whose character would take `caret`: the change from
 * `caret` to what a write of `patch` leaves on the next character. Empty when that is `caret` itself.
 */
export function armPatch(caret: RunStylePatch, armed: RunStylePatch, patch: RunStylePatch): RunStylePatch {
  const [next] = applyStyleToRange([{ text: ' ', ...withArmed(caret, armed) }], 0, 1, patch);
  const target: Record<string, unknown> = { ...next };
  delete target.text;
  const from = caret as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(target)])) {
    const flag = FLAGS.has(key);
    // `null` is a value here (no fill), not the absence of one.
    if (flag ? (from[key] ?? false) === (target[key] ?? false) : JSON.stringify(from[key]) === JSON.stringify(target[key])) continue;
    out[key] = key in target ? target[key] : (flag ? false : undefined);
  }
  return out as RunStylePatch;
}

/** `range` as the armed style shows over it: `patchRangeStyle`, with a key armed `undefined` taken off. */
export function armedOver(range: RangeStyle, armed: RunStylePatch): RangeStyle {
  const out: Record<string, unknown> = { ...patchRangeStyle(range, armed) };
  for (const [key, value] of Object.entries(armed)) if (value === undefined) delete out[key];
  return out as RangeStyle;
}
