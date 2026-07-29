/**
 * Character controls for the tool options bar — the caret-range half of text
 * properties, opposite the sidebar's node-level Character group.
 *
 * Props, not hooks: it renders a `RangeStyle` and reports a `RunStylePatch`,
 * and has no idea whether the caller routes that patch to a character range
 * (`applyStyleToSelection`) or to the node's own `TextStyle` (a collapsed
 * caret has no range to style). That routing is `App`'s.
 *
 * `MIXED` is rendered with each control's own indeterminate presentation,
 * matching `SelectionPanel`: `NumberField` shows a `Mixed` placeholder over
 * an empty value, `Select` shows a `Mixed` placeholder with no selected key,
 * `ColorField` shows its checkered chip. The toggles use `aria-pressed="mixed"`
 * — a toggle button, unlike the `Switch` the panel reaches for, has a real
 * ARIA tri-state.
 */
import { MIXED } from '@weasel-js/core';
import type { RangeStyle, RunStylePatch, StyledRun } from '@weasel-js/core';
import { ColorField, NumberField, ToggleBar } from '@weasel-js/ui';
import { FontFamilySelect } from './FontFamilySelect';
import s from './CharacterOptions.module.css';

export interface CharacterOptionsProps {
  /** Styling to display. `MIXED` at a key means the sources disagree there. */
  style: RangeStyle;
  /** Apply a styling change. One call per completed edit. */
  onPatch: (patch: RunStylePatch) => void;
}

/** The four additive run flags, in the order every text editor puts them. */
const FLAGS = [
  { value: 'bold', label: 'B', ariaLabel: 'Bold' },
  { value: 'italic', label: 'I', ariaLabel: 'Italic' },
  { value: 'underline', label: 'U', ariaLabel: 'Underline' },
  { value: 'strikethrough', label: 'S', ariaLabel: 'Strikethrough' },
] as const;

type FlagKey = (typeof FLAGS)[number]['value'];

export function CharacterOptions({ style, onPatch }: CharacterOptionsProps) {
  const on = FLAGS.filter((f) => style[f.value] === true).map((f) => f.value as FlagKey);
  const mixed = FLAGS.filter((f) => style[f.value] === MIXED).map((f) => f.value as FlagKey);

  const onFlagsChange = (next: readonly FlagKey[]): void => {
    // ToggleBar reports the whole next set; emit only the key that moved, so
    // a click on Bold never rewrites Italic. A mixed flag counts as off, so
    // clicking it lands in the "turned on" branch — the same rule
    // `toggleFlagInRange` applies to a partially-styled range.
    const patch: RunStylePatch = {};
    for (const f of FLAGS) {
      const before = style[f.value] === true;
      const after = next.includes(f.value);
      if (before !== after) patch[f.value] = after;
    }
    if (Object.keys(patch).length > 0) onPatch(patch);
  };

  const fill = style.fill;
  const solidFill = fill !== undefined && fill !== MIXED && 'color' in fill ? fill.color : undefined;
  // A gradient or pattern fill has no single color to show, so it gets the
  // same indeterminate treatment as a genuinely mixed range rather than a
  // swatch that claims the text is some solid color.
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
  onCommit: (n: number) => void;
}) {
  const { label, abbr, value, min, step, onCommit } = props;
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
