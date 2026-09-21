/**
 * Character controls for the tool options bar — the caret-range half of text
 * properties, opposite the sidebar's node-level Character group.
 *
 * The controls are not assembled here: `useTextTool.options` declares them and
 * `<ToolOptionsBar schema>` draws them, the same way the selection panel draws
 * node properties. This file is the adapter between that schema and a range —
 * a `RangeStyle` in, a `RunStylePatch` out — and has no idea whether the caller
 * applies the patch to the runs under a selection or arms it for the next
 * character typed at a collapsed caret. That routing is `useTextEdit`'s.
 *
 * `MIXED` becomes a path in the bar's `mixed` set, so each control shows its
 * own indeterminate presentation: a `Mixed` placeholder over an empty field,
 * a checkered color chip, `aria-pressed="mixed"` on a flag.
 */
import { MIXED, resolveScreenLength, SCRIPT_METRICS, useTextTool } from '@weasel-js/core';
import type { ScreenLength } from '@weasel-js/core';
import type { RangeStyle, RunStylePatch, StyledRun } from '@weasel-js/core';
import { ToggleBar, ToolOptionsBar, type PropertyRenderer } from '@weasel-js/ui';
import type { ReactNode } from 'react';
import s from './CharacterOptions.module.css';

export interface CharacterOptionsProps {
  /** Styling to display. `MIXED` at a key means the sources disagree there.
   *  Absent leaves the bar empty — the row is permanent chrome. */
  style?: RangeStyle;
  /** Apply a styling change. One call per completed edit. */
  onPatch: (patch: RunStylePatch) => void;
  /** Tenants of the bar that are not character styling, e.g. loupe controls. */
  children?: ReactNode;
  className?: string;
}

/** The keys the schema draws, in the order it declares them. */
type StyleKey = keyof typeof useTextTool.options.children;

export function CharacterOptions({ style, onPatch, children, className }: CharacterOptionsProps) {
  const editing = style !== undefined;
  return (
    <ToolOptionsBar
      className={className}
      label={editing ? 'Text' : undefined}
      schema={editing ? useTextTool.options : undefined}
      values={editing ? characterValues(style) : undefined}
      mixed={editing ? characterMixed(style) : undefined}
      renderers={RENDERERS}
      onChange={(path, value) => onPatch(characterPatch(path, value))}
    >
      {children}
    </ToolOptionsBar>
  );
}

/** One control's edit as a run patch. Only `fill` needs shaping: the schema
 *  draws a color, and a run's fill is a `FillStyle` object. */
export function characterPatch(path: string, value: unknown): RunStylePatch {
  if (path === 'fill') return { fill: { color: value as string } satisfies StyledRun['fill'] };
  return { [path]: value } as RunStylePatch;
}

/**
 * A range's styling as the bar's value map.
 *
 * Two keys are not read straight off the range. Sizes are `ScreenLength`, and
 * the strip edits world units, so a `{ px }` size shows its pixel count and
 * commits back as a plain number — editing one converts it. And `script` is a
 * preset over `baselineShift` / `fontScale`, so a range that names it and not
 * them still *has* a shift and a scale: the preset's. Showing those fields
 * blank would hide the relationship and read as "unset"; this is what
 * `resolveRuns` does too, and typing over one half overrides just that half
 * exactly as it does there.
 */
export function characterValues(style: RangeStyle): Record<string, unknown> {
  const script = style.script;
  const preset = script === 'super' || script === 'sub' ? SCRIPT_METRICS[script] : undefined;
  return {
    ...pick(style),
    fontSize: worldSize(style.fontSize),
    letterSpacing: worldSize(style.letterSpacing),
    baselineShift: style.baselineShift ?? preset?.shift,
    fontScale: style.fontScale ?? preset?.size,
    fill: solidFill(style.fill),
  };
}

/** The paths whose sources disagree — every `MIXED` key, plus a fill with no
 *  single color to show. */
export function characterMixed(style: RangeStyle): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(useTextTool.options.children) as StyleKey[]) {
    if (style[key as keyof RangeStyle] === MIXED) out.add(key);
  }
  // A gradient or pattern fill gets the same indeterminate treatment as a
  // genuinely mixed range, rather than a swatch claiming the text is some
  // solid color. The tag is checked as well as the key: a
  // `{ fill: 'pattern', pattern, color }` hybrid can't be produced any more,
  // but one can still arrive in an old document.
  const fill = style.fill;
  if (fill !== undefined && fill !== MIXED && solidFill(fill) === undefined) out.add('fill');
  return out;
}

/** Every key the schema draws that the range carries as-is. */
function pick(style: RangeStyle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(useTextTool.options.children) as StyleKey[]) {
    const v = style[key as keyof RangeStyle];
    if (v !== undefined && v !== MIXED) out[key] = v;
  }
  return out;
}

function solidFill(fill: RangeStyle['fill']): string | undefined {
  return fill !== undefined &&
    fill !== MIXED &&
    ((fill as { fill?: string }).fill === undefined || (fill as { fill?: string }).fill === 'solid')
    ? (fill as { color?: string }).color
    : undefined;
}

function worldSize(v: ScreenLength | typeof MIXED | undefined): number | undefined {
  return v === undefined || v === MIXED ? undefined : resolveScreenLength(v, 1);
}

/**
 * Superscript and subscript. Its own control rather than an enum toggle for
 * the reason the schema records: the two values are exclusive *and* absent is
 * a third state, so clicking the lit segment clears it.
 *
 * `mode="multiple"` even so, for two things `single` cannot give: `mixedValues`
 * exists only on multiple, and single's arrow-key roving *sets* the value as
 * focus moves, so a keyboard user could not pass over superscript without
 * applying it.
 */
const SCRIPTS = [
  { value: 'super', label: 'x²', ariaLabel: 'Superscript' },
  { value: 'sub', label: 'x₂', ariaLabel: 'Subscript' },
] as const;
type ScriptKey = (typeof SCRIPTS)[number]['value'];

const RENDERERS: Record<string, PropertyRenderer> = {
  script: (ctx) => {
    const value = ctx.value as ScriptKey | undefined;
    const on = value === 'super' || value === 'sub' ? [value] : [];
    return (
      <ToggleBar<ScriptKey>
        mode="multiple"
        size="sm"
        className={s.script}
        ariaLabel="Script"
        items={SCRIPTS.map((f) => ({ value: f.value, label: f.label, ariaLabel: f.ariaLabel }))}
        value={on}
        mixedValues={ctx.mixed ? ['super', 'sub'] : []}
        // The value just added wins, so clicking Subscript while Superscript
        // is on swaps rather than producing two. Adding nothing means the lit
        // segment was clicked: that clears, which is the enum's absence.
        onChange={(next) => ctx.setValue(next.find((v) => !on.includes(v)))}
      />
    );
  },
};
