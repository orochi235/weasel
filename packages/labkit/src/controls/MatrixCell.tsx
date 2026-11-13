import { getAlpha01, toHex8, withAlpha01 } from '@weasel-js/core';
import { isBuiltinPref, type PrefLeaf, type PrefNumber, prefLeafValue } from '@weasel-js/prefs';
import { qty } from '@weasel-js/quantity';
import { prefFieldProps } from '@weasel-js/ui/components/Prefs';
import { type PropertyControlProps, stepDisplay } from '@weasel-js/ui/components/Properties';
import { Focusable, Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import type { CSSProperties, DOMAttributes, MouseEvent, ReactElement, ReactNode } from 'react';
import { auto as autoValue } from '../config/auto';
import { useFieldChoices } from './fieldChoices';
import { numberText, summarizeLeaf } from './inDialog';

/** A color leaf whose default is empty: unset is a value of its own, not black. */
export const clearable = (leaf: PrefLeaf): boolean => leaf.kind === 'color' && leaf.default === '';

/** What a cell shows of a value it opens a popover to edit. */
function summaryOf(field: PropertyControlProps | null, leaf: PrefLeaf, value: unknown): ReactNode {
  if (field?.kind === 'number') {
    if (typeof field.value !== 'number') return '—';
    const text = typeof value === 'number' ? numberText(leaf as PrefNumber, value) : undefined;
    return text ?? qty(field.value, field.display ?? stepDisplay(field.step)).text;
  }
  if (field?.kind === 'enum') {
    const option = field.options.find((o) => o.value === field.value);
    if (!option) return '—';
    return typeof option.glyph === 'string' ? option.glyph : option.label;
  }
  if (field?.kind === 'string') return field.value || '—';
  return summarizeLeaf(leaf, value);
}

export function MatrixCell({
  path,
  leaf,
  value,
  name,
  hint,
  canUnpin,
  disabled = false,
  summary,
  setConfig,
  onOpen,
}: {
  path: string;
  leaf: PrefLeaf;
  value: unknown;
  /** The cell's accessible name: column and row. */
  name: string;
  /** Present while the cell inherits: where from. */
  hint?: string;
  canUnpin: boolean;
  /** The cell takes no input: its `enableIf`, or that of a group above it, does not hold. */
  disabled?: boolean;
  /** What the cell shows of its value, over the built-in reading. */
  summary?: (value: unknown) => ReactNode;
  setConfig: (path: string, value: unknown) => void;
  onOpen: (el: HTMLElement) => void;
}) {
  const shown = prefLeafValue(leaf, value);
  const write = (next: unknown): void => setConfig(path, next);
  const choices = useFieldChoices();
  const field = isBuiltinPref(leaf)
    ? prefFieldProps(leaf, { value: shown, setValue: write, fields: choices, disabled }, 'lab')
    : null;
  const label = hint ? `${name}, ${hint}` : name;

  // Option/Alt-click hands a pinned cell back to the fallback, and does nothing
  // else on any cell — it must not also flip or open what it lands on.
  const unpinned = (e: MouseEvent): boolean => {
    if (!e.altKey) return false;
    e.preventDefault();
    if (canUnpin) setConfig(path, autoValue);
    return true;
  };

  // The shape `Focusable` asks of the element it makes a tooltip trigger.
  let control: ReactElement<DOMAttributes<HTMLElement>, string>;
  if (field?.kind === 'boolean') {
    const on = field.value === true;
    control = (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="lk-control-matrix__switch"
        disabled={disabled}
        onClick={(e) => {
          if (!unpinned(e)) field.onChange(!on);
        }}
      >
        <span className="lk-control-matrix__track" aria-hidden="true">
          <span className="lk-control-matrix__thumb" />
        </span>
      </button>
    );
  } else if (field?.kind === 'color') {
    // Called, not rendered: `Focusable` attaches its ref and handlers to the element it is handed.
    control = colorCell({
      value: field.value,
      alpha: field.alpha === true,
      clearable: clearable(leaf),
      label,
      disabled,
      unpinned,
      onChange: field.onChange,
      onOpen,
    });
  } else {
    const valueClass =
      field?.kind === 'number' ? 'lk-control-matrix__value is-number' : 'lk-control-matrix__value';
    control = (
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        className={valueClass}
        disabled={disabled}
        onClick={(e) => {
          if (!unpinned(e)) onOpen(e.currentTarget);
        }}
      >
        {summary ? summary(shown) : summaryOf(field, leaf, shown)}
      </button>
    );
  }

  if (!hint) return control;
  return (
    <TooltipTrigger>
      <Focusable>{control}</Focusable>
      <Tooltip>{hint}</Tooltip>
    </TooltipTrigger>
  );
}

/** A color cell: a swatch that edits in place, or, for a color that may be unset, a chip that opens the popover,
 *  the only place it can be cleared. */
function colorCell({
  value,
  alpha,
  clearable: unsettable,
  label,
  disabled,
  unpinned,
  onChange,
  onOpen,
}: {
  value: unknown;
  alpha: boolean;
  clearable: boolean;
  label: string;
  disabled: boolean;
  unpinned: (e: MouseEvent) => boolean;
  onChange: (next: string) => void;
  onOpen: (el: HTMLElement) => void;
}): ReactElement<DOMAttributes<HTMLElement>, string> {
  const set = typeof value === 'string' && value !== '';
  if (!unsettable) {
    const stored = set ? toHex8(value) : '#000000ff';
    return (
      <input
        type="color"
        aria-label={label}
        className="lk-control-matrix__swatch"
        disabled={disabled}
        value={stored.slice(0, 7)}
        onClick={(e) => {
          unpinned(e);
        }}
        onChange={(e) => {
          const rgb = e.currentTarget.value;
          onChange(alpha ? withAlpha01(rgb, getAlpha01(stored)) : rgb);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={set ? label : `${label}, unset`}
      aria-haspopup="dialog"
      className="lk-control-matrix__value"
      disabled={disabled}
      onClick={(e) => {
        if (!unpinned(e)) onOpen(e.currentTarget);
      }}
    >
      <span
        className={set ? 'lk-control-matrix__chip' : 'lk-control-matrix__chip is-unset'}
        style={set ? ({ '--lk-chip': value } as CSSProperties) : undefined}
        aria-hidden="true"
      />
    </button>
  );
}
