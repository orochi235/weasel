/**
 * Character controls for a text edit in progress: the adapter between the
 * `useTextTool.options` schema and a range — a `RangeStyle` in, a
 * `RunStylePatch` out. Whether the patch lands on the runs under a selection
 * or is armed for the next character typed at a collapsed caret is the caller's.
 *
 * `MIXED` becomes a path in the bar's `mixed` set, so each control shows its
 * own indeterminate presentation.
 */
import {
  isSolidPaint, MIXED, numericWeight, resolveFill, resolveScreenLength, SCRIPT_METRICS, scriptMetricsFor, useTextTool,
} from '@weasel-js/core';
import type { ScreenLength } from '@weasel-js/core';
import type { RangeStyle, RunStylePatch, StyledRun } from '@weasel-js/core';
import { ToolOptionsBar } from '../ToolOptionsBar';
import type { ReactNode } from 'react';

/** Props for {@link CharacterOptions}. */
export interface CharacterOptionsProps {
  /** Styling to display. `MIXED` at a key means the sources disagree there.
   *  Absent or `null` leaves the bar empty — the row is permanent chrome. */
  style?: RangeStyle | null;
  /** Apply a styling change. One call per completed edit. */
  onPatch: (patch: RunStylePatch) => void;
  /** Tenants of the bar that are not character styling, e.g. loupe controls. */
  children?: ReactNode;
  className?: string;
}

const CHROME_CLASS = 'wzl-character-options';

/**
 * Is `el` part of a `CharacterOptions` bar, or of a kit popover one of its
 * controls opened? Pass it as `useTextEdit`'s `isEditorChrome`, so using the
 * bar does not end the edit it styles.
 */
export function isCharacterChrome(el: Element): boolean {
  // A popover renders in a portal under <body>, outside the bar's subtree.
  return el.closest(`.${CHROME_CLASS}, [data-weasel-overlay]`) !== null;
}

/** The keys the schema draws, in the order it declares them. */
type StyleKey = keyof typeof useTextTool.options.children;

/**
 * The strip of character controls for a text edit in progress. Wire it to
 * `useTextEdit`: `style` takes `effectiveStyle`, `onPatch` takes
 * `applyStyleToSelection`, and {@link isCharacterChrome} goes in as
 * `isEditorChrome`.
 */
export function CharacterOptions({ style, onPatch, children, className }: CharacterOptionsProps) {
  const editing = style != null;
  return (
    <ToolOptionsBar
      className={className ? `${CHROME_CLASS} ${className}` : CHROME_CLASS}
      label={editing ? 'Text' : undefined}
      schema={editing ? useTextTool.options : undefined}
      values={editing ? characterValues(style) : undefined}
      mixed={editing ? characterMixed(style) : undefined}
      onChange={(path, value) => onPatch(characterPatch(path, value))}
    >
      {children}
    </ToolOptionsBar>
  );
}

/** One control's edit as a run patch. Only `fill` needs shaping: the schema
 *  draws a color and a chip for none, and a run's fill is a record holding
 *  a `Paint`, or `null`. Turning the chip off fills with the color the field shows beside it. */
function characterPatch(path: string, value: unknown): RunStylePatch {
  if (path === 'fill') return { fill: { paint: { color: value as string } } satisfies StyledRun['fill'] };
  if (path === 'noFill') {
    return { fill: value === true ? null : { paint: { color: useTextTool.options.children.fill.default } } };
  }
  return { [path]: value } as RunStylePatch;
}

/**
 * A range's styling as the bar's value map.
 *
 * Sizes are `ScreenLength`, and the strip edits world units, so a `{ px }`
 * size shows its pixel count and commits back as a plain number — editing one
 * converts it. `script` is a preset over `baselineShift` / `fontScale`, so a
 * range that names it and not them shows the preset's shift and scale, as
 * `resolveRuns` does.
 */
function characterValues(style: RangeStyle): Record<string, unknown> {
  const script = style.script;
  const preset = script === 'super' || script === 'sub' ? scriptPresets(style)[script] : undefined;
  return {
    ...pick(style),
    fontSize: worldSize(style.fontSize),
    letterSpacing: worldSize(style.letterSpacing),
    baselineShift: style.baselineShift ?? preset?.shift,
    fontScale: style.fontScale ?? preset?.size,
    fill: solidFill(style.fill),
    noFill: style.fill !== MIXED && resolveFill(style.fill) === null,
  };
}

/** The presets the range's face gives `script` — the kit defaults when the
 *  range spans more than one family, since no single face then applies. */
function scriptPresets(style: RangeStyle): typeof SCRIPT_METRICS {
  if (typeof style.fontFamily !== 'string') return SCRIPT_METRICS;
  const weight = style.fontWeight !== undefined && style.fontWeight !== MIXED
    ? numericWeight(style.fontWeight)
    : style.bold === true ? 700 : 400;
  return scriptMetricsFor(style.fontFamily, weight, style.italic === true ? 'italic' : 'normal');
}

/** The paths whose sources disagree — every `MIXED` key, plus a fill with no
 *  single color to show. */
function characterMixed(style: RangeStyle): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(useTextTool.options.children) as StyleKey[]) {
    if (style[key as keyof RangeStyle] === MIXED) out.add(key);
  }
  // A gradient or pattern fill gets the same indeterminate treatment as a
  // mixed range, rather than a swatch claiming the text is some solid color.
  // The tag is checked as well as the key: a tile paint carries a `color` too.
  const fill = style.fill;
  if (fill !== MIXED && resolveFill(fill) !== null && solidFill(fill) === undefined) out.add('fill');
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
  if (fill === MIXED) return undefined;
  const paint = resolveFill(fill)?.paint;
  return isSolidPaint(paint) ? paint.color : undefined;
}

function worldSize(v: ScreenLength | typeof MIXED | undefined): number | undefined {
  return v === undefined || v === MIXED ? undefined : resolveScreenLength(v, 1);
}
