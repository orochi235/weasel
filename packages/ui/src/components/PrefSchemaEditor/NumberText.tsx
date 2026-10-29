import { useState } from 'react';
import { imeKey } from '@weasel-js/headless';
import { Input } from '../Input';
import s from './PrefSchemaEditor.module.css';

/**
 * A number typed as text and taken when the field is left, or on Enter. Empty text is taken as `undefined`; text
 * that is no number, or a number `accept` refuses, is put back as it was.
 */
export function NumberText({ label, value, placeholder, accept, onCommit }: {
  label: string;
  value: number | undefined;
  placeholder?: string;
  accept?(n: number): boolean;
  onCommit(n: number | undefined): void;
}) {
  const shown = value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setDraft(shown);
  }
  const commit = () => {
    const t = draft.trim();
    const n = t === '' ? undefined : Number(t);
    // What is taken comes back as `value`; text that changes nothing reads as the value again.
    setDraft(shown);
    if (n === undefined || (Number.isFinite(n) && accept?.(n) !== false)) onCommit(n);
  };
  return <Input className={s.number} aria-label={label} placeholder={placeholder} value={draft} onChange={setDraft} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter' && !imeKey(e.nativeEvent)) commit(); }} />;
}
