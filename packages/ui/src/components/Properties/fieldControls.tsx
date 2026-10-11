import { type ReactNode, useEffect, useRef, useState } from 'react';
import { getAlpha01, toHex8, withAlpha01 } from '@weasel-js/core';
import { dlog } from '../../dlog';
import { ColorField } from '../ColorField';
import { FontFamilySelect } from '../FontFamilySelect';
import { FontWeightSelect } from '../FontWeightSelect';
import { Input } from '../Input';
import { MenuButton } from '../MenuButton';
import { PaintField } from '../PaintField';
import { PaintInput } from '../PaintInput';
import { Radio, RadioGroup } from '../RadioGroup';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import { ToggleBar } from '../ToggleBar';
import sharedCheckbox from '../checkbox.module.css';
import type {
  PropertyBooleanFieldProps,
  PropertyColorFieldProps,
  PropertyControlProps,
  PropertyEnumFieldProps,
  PropertyOption,
  PropertyPaintFieldProps,
  PropertyStringFieldProps,
} from './fieldTypes';
import { ignore, NumberInput } from './NumberControls';
import s from './Properties.module.css';

/** The control a field's `kind` and `control` choose, for every kind but a slider. */
export function ControlBody(props: PropertyControlProps) {
  switch (props.kind) {
    case 'boolean':
      return <BooleanControl {...props} />;
    case 'number':
      return <NumberInput {...props} />;
    case 'string':
      return <StringControl {...props} />;
    case 'enum':
      return <EnumControl {...props} />;
    case 'color':
      return <ColorControl {...props} />;
    case 'paint':
      return <PaintControl {...props} />;
    case 'font-family':
      return (
        <FontFamilySelect
          className={props.className}
          value={props.mixed ? undefined : props.value}
          mixed={props.mixed}
          onChange={props.onChange}
          weight={props.weight}
          fontStyle={props.fontStyle}
          isDisabled={props.disabled}
          aria-label={props.name}
        />
      );
    case 'font-weight':
      return (
        <FontWeightSelect
          className={props.className}
          value={props.mixed ? undefined : props.value}
          mixed={props.mixed}
          family={props.family}
          onChange={props.onChange}
          isDisabled={props.disabled}
          aria-label={props.name}
        />
      );
    default: {
      // Unreachable while every kind has an arm; a new kind without one is a
      // compile error here rather than an empty cell.
      const _exhaustive: never = props;
      throw new Error(`PropertyControl: no control for kind "${(_exhaustive as { kind: string }).kind}"`);
    }
  }
}

// ── Kinds ────────────────────────────────────────────────────────────────

/** A cue for a state the control itself cannot draw: a switch has no
 *  indeterminate form, and nothing has an "unset" one. */
function Dimmed({ mixed, unset, children }: { mixed?: boolean; unset?: boolean; children: ReactNode }) {
  if (!mixed && !unset) return <>{children}</>;
  return (
    <span className={s.dimmed} title={mixed ? 'Mixed' : 'Not set'}>
      {children}
    </span>
  );
}

function BooleanControl(p: PropertyBooleanFieldProps) {
  const on = !p.mixed && p.value === true;
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = p.mixed === true;
  });
  if (p.control === 'toggle') {
    // Unselected already is how a toggle button says "not set", and dimming it
    // would read as disabled; mixed has a real ARIA form on one.
    const key = 'on';
    return (
      <ToggleBar<string>
        mode="multiple"
        size="sm"
        variant="flat"
        className={p.className}
        ariaLabel={p.name}
        items={[{ value: key, label: p.glyph ?? <FitLabel forms={labelForms(p.name, p.short)} />, ariaLabel: p.name, disabled: p.disabled }]}
        value={on ? [key] : []}
        mixedValues={p.mixed ? [key] : []}
        onChange={(next) => p.onChange(next.includes(key))}
      />
    );
  }
  if (p.control === 'switch') {
    return (
      <Dimmed mixed={p.mixed} unset={p.unset}>
        <Switch className={p.className} isSelected={on} isDisabled={p.disabled} onChange={p.onChange} aria-label={p.name} />
      </Dimmed>
    );
  }
  // A native box rather than the kit's `Checkbox`: that one renders a `<label>`
  // of its own, which may not sit inside the row's, and without the row's the
  // label text would no longer toggle it.
  return (
    <Dimmed unset={p.unset}>
      <input
        ref={box}
        id={p.id}
        type="checkbox"
        className={p.className ? `${sharedCheckbox.checkbox} ${p.className}` : sharedCheckbox.checkbox}
        aria-label={p.name}
        checked={on}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.checked)}
      />
    </Dimmed>
  );
}

/**
 * The text a field shows and how an edit to it lands. With `onInput` the
 * field drafts: the draft shows while it differs from `value`, and settles
 * through `onChange` on blur or Enter. Without it, every keystroke is the
 * value.
 */
function useTextEdit(p: PropertyStringFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = p.mixed ? '' : (p.value ?? '');
  const drafting = p.onInput !== undefined;
  return {
    shown: draft ?? value,
    type: (next: string) => {
      if (!drafting) {
        p.onChange(next);
        return;
      }
      setDraft(next);
      p.onInput?.(next);
    },
    settle: () => {
      if (draft !== null && draft !== value) p.onChange(draft);
      setDraft(null);
    },
  };
}

function StringControl(p: PropertyStringFieldProps) {
  const edit = useTextEdit(p);
  const placeholder = p.mixed ? 'Mixed' : p.placeholder;
  if (p.control === 'textarea') {
    return (
      <textarea
        id={p.id}
        className={p.className ? `${s.textarea} ${p.className}` : s.textarea}
        aria-label={p.name}
        value={edit.shown}
        placeholder={placeholder}
        maxLength={p.maxLength}
        disabled={p.disabled}
        rows={3}
        onChange={(e) => edit.type(e.target.value)}
        onBlur={edit.settle}
      />
    );
  }
  return (
    <Input
      id={p.id}
      className={p.className ? `${s.textField} ${p.className}` : s.textField}
      value={edit.shown}
      placeholder={placeholder}
      maxLength={p.maxLength}
      isDisabled={p.disabled}
      aria-label={p.name}
      onChange={edit.type}
      onBlur={edit.settle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLElement).blur();
      }}
    />
  );
}

// A row's <label> text also holds the help button's ⓘ and any readout, so a
// control takes its name from the string label, not from the <label> that
// `for` points at it.
export function nameOf(label: ReactNode): string | undefined {
  return typeof label === 'string' ? label : undefined;
}

/** A segment drawing a glyph hides its label, so the label comes back as its tooltip. */
function glyphTip(o: PropertyOption<string>): ReactNode {
  return o.glyph === undefined || o.glyph === null ? undefined : o.label;
}

function EnumControl(p: PropertyEnumFieldProps) {
  const chosen = !p.mixed && p.options.some((opt) => opt.value === p.value);
  const current = chosen ? (p.value as string) : null;

  if (p.control === 'radio') {
    return (
      <RadioGroup className={p.className} value={current} isDisabled={p.disabled} onChange={p.onChange} aria-label={p.name}>
        {p.options.map((o) => (
          <Radio key={o.value} value={o.value} isDisabled={o.disabled}>
            {o.label}
          </Radio>
        ))}
      </RadioGroup>
    );
  }
  if (p.control === 'menu') {
    const held = current === null ? undefined : p.options.find((o) => o.value === current);
    const reads = p.mixed ? 'Mixed' : held ? held.label : (p.placeholder ?? (p.unset ? '—' : 'Choose option…'));
    // The button's text is its value, so its name has to carry both.
    const named = p.name === undefined ? undefined : typeof reads === 'string' ? `${p.name}: ${reads}` : p.name;
    return (
      <MenuButton<string>
        className={p.className}
        aria-label={named}
        label={reads}
        current={held !== undefined}
        isDisabled={p.disabled}
        items={p.options.map((o) => ({ value: o.value, label: o.label, isDisabled: o.disabled }))}
        onAction={p.onChange}
      />
    );
  }
  if (p.control === 'toggle' && p.onClear) {
    // `multiple` for what `single` cannot give: a mixed state on each segment,
    // and arrow keys that move focus without choosing. At most one stays lit —
    // the segment just added wins, and adding none means the lit one was
    // clicked off.
    const { onClear } = p;
    const lit = current === null ? [] : [current];
    return (
      <ToggleBar<string>
        mode="multiple"
        size="sm"
        variant="flat"
        className={p.className ? `${s.toggleBar} ${p.className}` : s.toggleBar}
        ariaLabel={p.name}
        items={p.options.map((o) => ({
          value: o.value,
          label: o.glyph ?? <FitLabel forms={labelForms(o.label, o.short)} />,
          ariaLabel: nameOf(o.label),
          tooltip: glyphTip(o),
          disabled: p.disabled || o.disabled,
        }))}
        value={lit}
        mixedValues={p.mixed ? p.options.map((o) => o.value) : []}
        onChange={(next) => {
          const added = next.find((v) => !lit.includes(v));
          if (added !== undefined) p.onChange(added);
          else onClear();
        }}
      />
    );
  }
  if (p.control === 'toggle') {
    return (
      <ToggleBar<string>
        size="sm"
        variant="flat"
        className={p.className ? `${s.toggleBar} ${p.className}` : s.toggleBar}
        ariaLabel={p.name}
        items={p.options.map((o) => ({
          value: o.value,
          label: o.glyph ?? <FitLabel forms={labelForms(o.label, o.short)} />,
          ariaLabel: nameOf(o.label),
          tooltip: glyphTip(o),
          disabled: p.disabled || o.disabled,
        }))}
        value={current}
        onChange={(next) => {
          if (next !== null) p.onChange(next);
        }}
      />
    );
  }
  return (
    <Select<string>
      className={p.className ? `${s.select} ${p.className}` : s.select}
      triggerId={p.id}
      isDisabled={p.disabled}
      aria-label={p.name}
      placeholder={p.mixed ? 'Mixed' : (p.placeholder ?? (p.unset ? '—' : 'Choose option…'))}
      selectedKey={current}
      options={p.options.map((o) => ({
        value: o.value,
        label: o.label,
        icon: o.glyph,
        isDisabled: o.disabled,
      }))}
      onSelectionChange={(v) => {
        dlog('property-panel', 'select', { name: p.name, value: v });
        p.onChange(v);
      }}
    />
  );
}

/** A hex color as the `#rrggbb` it paints and the 0..1 alpha beside it.
 *  Anything unreadable is opaque black, which is what a swatch would show for
 *  it anyway. */
function splitAlpha(value: string | undefined): { rgb: string; alpha: number } {
  const eight = toHex8(value?.trim() ?? '');
  if (!/^#[0-9a-f]{8}$/i.test(eight)) return { rgb: '#000000', alpha: 1 };
  return { rgb: eight.slice(0, 7).toLowerCase(), alpha: getAlpha01(eight) };
}

function ColorControl(p: PropertyColorFieldProps) {
  const withAlpha = p.alpha !== undefined && p.alpha !== false;
  const apart = typeof p.alpha === 'number';
  const split = splitAlpha(p.value);
  const alpha = apart ? (p.alpha as number) : split.alpha;

  // `ColorField` holds alpha in the hex. One kept in a channel of its own goes
  // in with the color and comes back out of it, each half to its own callback.
  // Which half the gesture in progress has moved. A caller following the live
  // callbacks has already moved `value` by the time the gesture settles, so
  // comparing against it then would find nothing to commit.
  const moved = useRef({ rgb: false, alpha: false });
  const route =
    (write: (hex: string) => void, own: ((a: number) => void) | undefined, settles: boolean) => (hex: string) => {
      if (!apart) {
        write(hex);
        return;
      }
      const next = splitAlpha(hex);
      // Read back at the track's percent, which is all a hex byte can hold of it.
      const a = Math.round(next.alpha * 100) / 100;
      const differs = { rgb: next.rgb !== split.rgb, alpha: a !== Math.round(alpha * 100) / 100 };
      const gesture = { rgb: moved.current.rgb || differs.rgb, alpha: moved.current.alpha || differs.alpha };
      moved.current = settles ? { rgb: false, alpha: false } : gesture;
      const half = settles ? gesture : differs;
      if (half.rgb || !own) write(next.rgb);
      if (half.alpha) own?.(a);
    };
  // As a number does: one callback is the live one, and the commit at the end
  // of a gesture would only repeat its last call.
  const drafting = p.onInput !== undefined || p.onAlphaInput !== undefined;
  const live = route(p.onInput ?? p.onChange, p.onAlphaInput ?? p.onAlphaChange, false);
  const settled = drafting ? route(p.onChange, p.onAlphaChange, true) : ignore;
  return (
    <ColorField
      id={p.id}
      className={p.className ? `${s.colorField} ${p.className}` : s.colorField}
      value={p.mixed ? undefined : withAlpha ? withAlpha01(split.rgb, alpha) : (p.value ?? '#000000')}
      mixed={p.mixed}
      alpha={withAlpha}
      alphaDisabled={p.alphaDisabled}
      disabled={p.disabled}
      onInput={live}
      onChange={settled}
      aria-label={p.name}
    />
  );
}

/** Takes a subtree out of focus order, hit testing, and the accessibility tree. Set on the node: React 18 does not know the attribute. */
const makeInert = (el: HTMLElement | null): void => {
  el?.toggleAttribute('inert', true);
};

function PaintControl(p: PropertyPaintFieldProps) {
  if (p.disabled && p.control !== 'inline') {
    return <PaintField className={p.className} value={p.value} mixed={p.mixed} unset={p.unset} disabled onChange={p.onChange} aria-label={p.name} />;
  }
  const Editor = p.control === 'inline' ? PaintInput : PaintField;
  const editor = (
    <Editor
      className={p.disabled ? undefined : p.className}
      value={p.value}
      mixed={p.mixed}
      unset={p.unset}
      kinds={p.kinds}
      allowNone={p.allowNone}
      onChange={p.onChange}
      onInput={p.onInput}
      aria-label={p.name}
    />
  );
  if (!p.disabled) return editor;
  // The inline editor is a stack of controls, and a kind's editor may be a consumer's: drawn inert, it keeps
  // the height it has enabled, so the rows under it do not move when a condition flips.
  return (
    <div className={p.className ? `${s.paintOff} ${p.className}` : s.paintOff} role="group" aria-label={p.name} aria-disabled="true">
      <div ref={makeInert} className={s.paintOffBody}>
        {editor}
      </div>
    </div>
  );
}
