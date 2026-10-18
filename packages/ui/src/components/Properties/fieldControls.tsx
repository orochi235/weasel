import { type ReactNode, useEffect, useRef, useState } from 'react';
import { FontFamilySelect } from '../FontFamilySelect';
import { FontWeightSelect } from '../FontWeightSelect';
import { Input } from '../Input';
import { Switch } from '../Switch';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import { ToggleBar } from '../ToggleBar';
import sharedCheckbox from '../checkbox.module.css';
import { NumberInput } from './NumberControls';
import type {
  PropertyBooleanFieldProps,
  PropertyControlProps,
  PropertyStringFieldProps,
} from './fieldTypes';
import { ColorControl, PaintControl } from './ColorControls';
import { EnumControl } from './EnumControl';
import { PropertyReadout } from './PropertyReadout';
import s from './Properties.module.css';

/** The control a field's `kind` and `control` choose, for every kind but a slider. */
export function ControlBody(props: PropertyControlProps) {
  if (props.readOnly) return <PropertyReadout {...props} />;
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
 * The text a field shows and how an edit to it lands: the draft shows while it
 * differs from `value`, `onInput` gets each keystroke, and the draft settles
 * through `onChange` on blur or Enter. Escape drops it, and gives `onInput` back
 * the value typing began from.
 */
function useTextEdit(p: PropertyStringFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape leaves by blurring, and that blur runs the handler of the render before the draft was dropped.
  const canceled = useRef(false);
  const value = p.mixed ? '' : (p.value ?? '');
  return {
    shown: draft ?? value,
    type: (next: string) => {
      canceled.current = false;
      setDraft(next);
      p.onInput?.(next);
    },
    settle: () => {
      if (draft !== null && draft !== value && !canceled.current) p.onChange(draft);
      canceled.current = false;
      setDraft(null);
    },
    keyDown: (e: { key: string; target: EventTarget }) => {
      if (e.key !== 'Escape') return;
      canceled.current = true;
      if (draft !== null) p.onInput?.(value);
      setDraft(null);
      (e.target as HTMLElement).blur();
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
        onKeyDown={edit.keyDown}
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
        else edit.keyDown(e);
      }}
    />
  );
}
