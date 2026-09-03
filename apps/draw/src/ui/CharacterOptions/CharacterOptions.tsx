/**
 * Character controls for the tool options bar — the caret-range half of text
 * properties, opposite the sidebar's node-level Character group.
 *
 * Props, not hooks: it renders a `RangeStyle` and reports a `RunStylePatch`,
 * and has no idea whether the caller applies that patch to the runs under a
 * selection or arms it for the next character typed at a collapsed caret.
 * That routing is `useTextEdit`'s.
 *
 * `MIXED` is rendered with each control's own indeterminate presentation,
 * matching `SelectionPanel`: `NumberField` shows a `Mixed` placeholder over
 * an empty value, `Select` shows a `Mixed` placeholder with no selected key,
 * `ColorField` shows its checkered chip. The toggles use `aria-pressed="mixed"`
 * — a toggle button, unlike the `Switch` the panel reaches for, has a real
 * ARIA tri-state.
 */
import { MIXED, SCRIPT_METRICS } from '@weasel-js/core';
import type { RangeStyle, RunStylePatch, StyledRun } from '@weasel-js/core';
import { ColorField, FontFamilySelect, NumberField, ToggleBar } from '@weasel-js/ui';
import s from './CharacterOptions.module.css';

export interface CharacterOptionsProps {
  /** Styling to display. `MIXED` at a key means the sources disagree there. */
  style: RangeStyle;
  /** Apply a styling change. One call per completed edit. */
  onPatch: (patch: RunStylePatch) => void;
}

/** The five additive run flags, in the order every text editor puts them.
 *  Overline has no conventional letter, so it borrows O's and wears the rule
 *  it applies. */
const FLAGS = [
  { value: 'bold', label: 'B', ariaLabel: 'Bold' },
  { value: 'italic', label: 'I', ariaLabel: 'Italic' },
  { value: 'underline', label: 'U', ariaLabel: 'Underline' },
  { value: 'strikethrough', label: 'S', ariaLabel: 'Strikethrough' },
  { value: 'overline', label: <span className={s.overGlyph}>O</span>, ariaLabel: 'Overline' },
] as const;

type FlagKey = (typeof FLAGS)[number]['value'];

/**
 * Superscript and subscript. Not a fifth and sixth flag: `script` is one
 * three-state enum whose two values are mutually exclusive, so this is a
 * separate control that happens to look like the flags.
 *
 * `mode="multiple"` rather than `single` even so, for two reasons `single`
 * cannot give: `mixedValues` exists only on multiple, and single's arrow-key
 * roving *sets* the value as focus moves, so a keyboard user could not pass
 * over superscript without applying it. Exclusivity is enforced below.
 */
const SCRIPTS = [
  { value: 'super', label: 'x²', ariaLabel: 'Superscript' },
  { value: 'sub', label: 'x₂', ariaLabel: 'Subscript' },
] as const;

type ScriptKey = (typeof SCRIPTS)[number]['value'];

export function CharacterOptions({ style, onPatch }: CharacterOptionsProps) {
  const on = FLAGS.filter((f) => style[f.value] === true).map((f) => f.value as FlagKey);
  const mixed = FLAGS.filter((f) => style[f.value] === MIXED).map((f) => f.value as FlagKey);

  const onFlagsChange = (next: readonly FlagKey[]): void => {
    // ToggleBar reports the whole next set; emit only the key that moved, so
    // a click on Bold never rewrites Italic. A mixed flag counts as off, so
    // clicking it lands in the "turned on" branch — the same rule
    // `patchForToggle` applies to a partially-styled range.
    const patch: RunStylePatch = {};
    for (const f of FLAGS) {
      const before = style[f.value] === true;
      const after = next.includes(f.value);
      if (before !== after) patch[f.value] = after;
    }
    if (Object.keys(patch).length > 0) onPatch(patch);
  };

  const script = style.script;
  const scriptOn = script === 'super' || script === 'sub' ? [script] : [];
  const scriptMixed: ScriptKey[] = script === MIXED ? ['super', 'sub'] : [];

  // `script` is a preset over the two primitives, so a run that names it and
  // not them still *has* a shift and a scale — the preset's. Showing the
  // fields blank there would hide the relationship and read as "unset"; this
  // is also what `resolveRuns` does, and typing over one half overrides just
  // that half exactly as it does.
  const preset = script === 'super' || script === 'sub' ? SCRIPT_METRICS[script] : undefined;
  const shift = style.baselineShift ?? preset?.shift;
  const scale = style.fontScale ?? preset?.size;

  const onScriptChange = (next: readonly ScriptKey[]): void => {
    // The value the user just added wins, so clicking Subscript while
    // Superscript is on swaps rather than producing two. Adding nothing means
    // they clicked the lit segment: that clears, which is the enum's absence.
    const added = next.find((v) => !scriptOn.includes(v));
    onPatch({ script: added });
  };

  const fill = style.fill;
  // A gradient or pattern fill has no single color to show, so it gets the
  // same indeterminate treatment as a genuinely mixed range rather than a
  // swatch that claims the text is some solid color. The tag is checked as
  // well as the key: a `{ fill: 'pattern', pattern, color }` hybrid can't be
  // produced any more, but one can still arrive in an old document.
  const solidFill =
    fill !== undefined && fill !== MIXED && (fill.fill === undefined || fill.fill === 'solid')
      ? (fill as { color?: string }).color
      : undefined;
  const fillMixed = fill === MIXED || (fill !== undefined && solidFill === undefined);

  return (
    <div className={s.root}>
      <ToggleBar<FlagKey>
        mode="multiple"
        size="sm"
        items={FLAGS.map((f) => ({ value: f.value, label: f.label, ariaLabel: f.ariaLabel }))}
        value={on}
        mixedValues={mixed}
        onChange={onFlagsChange}
        ariaLabel="Character style"
      />
      <ToggleBar<ScriptKey>
        mode="multiple"
        size="sm"
        items={SCRIPTS.map((f) => ({ value: f.value, label: f.label, ariaLabel: f.ariaLabel }))}
        value={scriptOn}
        mixedValues={scriptMixed}
        onChange={onScriptChange}
        ariaLabel="Script"
      />
      <FontFamilySelect
        className={s.family}
        value={style.fontFamily === MIXED ? undefined : style.fontFamily}
        mixed={style.fontFamily === MIXED}
        weight={style.bold === true ? 700 : 400}
        fontStyle={style.italic === true ? 'italic' : 'normal'}
        onChange={(fontFamily) => onPatch({ fontFamily })}
      />
      <NumericOption
        label="Size"
        abbr="Size"
        value={style.fontSize}
        min={1}
        step={1}
        onCommit={(fontSize) => onPatch({ fontSize })}
      />
      <NumericOption
        label="Tracking"
        // The typographic term, and short enough for a strip. "Tracking"
        // stays the accessible name.
        abbr="VA"
        value={style.letterSpacing}
        step={0.1}
        onCommit={(letterSpacing) => onPatch({ letterSpacing })}
      />
      {/* The two primitives `script` is a preset over. Both are fractions of
          the inherited size, so both read as percentages. `step` is a tenth
          of a percentage point because React Aria snaps the *displayed* value
          to it — a coarser step would render the 58.3% of a superscript as
          60% and then commit that on the next edit. */}
      <NumericOption
        label="Baseline shift"
        abbr="Shift"
        value={shift}
        step={0.001}
        percent
        onCommit={(baselineShift) => onPatch({ baselineShift })}
      />
      <NumericOption
        label="Scale"
        abbr="Scale"
        value={scale}
        min={0.01}
        step={0.001}
        percent
        onCommit={(fontScale) => onPatch({ fontScale })}
      />
      <ColorField
        className={s.color}
        value={solidFill}
        mixed={fillMixed}
        alpha
        aria-label="Color"
        onChange={(color) => onPatch({ fill: { color } satisfies StyledRun['fill'] })}
      />
    </div>
  );
}

/** `NumberField` bound to one possibly-`MIXED` numeric key. React Aria's
 *  field already commits on blur / Enter rather than per keystroke, so there
 *  is no draft to hold here — one `onChange` is one undo entry. `NaN` is its
 *  "no value" input, which is what a mixed or unset key has. */
function NumericOption(props: {
  label: string;
  /** Compact visible marker. The strip has no room for a real label, and two
   *  identical-looking number boxes are worse than an abbreviation. */
  abbr: string;
  value: number | typeof MIXED | undefined;
  min?: number;
  step: number;
  /** Display and accept the value as a percentage. React Aria does the
   *  ×100 both ways, so the value crossing this boundary stays the raw
   *  fraction the run stores. */
  percent?: boolean;
  onCommit: (n: number) => void;
}) {
  const { label, abbr, value, min, step, percent, onCommit } = props;
  const isMixed = value === MIXED;
  return (
    <span className={s.field}>
      <span className={s.abbr} aria-hidden="true" title={label}>{abbr}</span>
      <NumberField
        className={s.number}
        aria-label={label}
        value={isMixed || typeof value !== 'number' ? NaN : value}
        placeholder={isMixed ? 'Mixed' : undefined}
        minValue={min}
        step={step}
        formatOptions={percent ? { style: 'percent', maximumFractionDigits: 1 } : undefined}
        hideSteppers
        // Select on focus: these fields always hold a value (the effective
        // one), so typing a new size has to replace rather than append —
        // clicking in and typing "34" over a "16" otherwise reads 3416.
        onFocus={(e) => {
          if (e.target instanceof HTMLInputElement) e.target.select();
        }}
        onChange={(n) => {
          if (Number.isNaN(n)) return;
          onCommit(n);
        }}
      />
    </span>
  );
}
