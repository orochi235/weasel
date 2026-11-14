import { useState } from 'react';
import { useIconGlyph, useIconVariant } from '@weasel-js/core';
import { iconParts, toIconRef, toIconSpec, type IconSpec } from '@weasel-js/icons';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Icon } from '../Icon/Icon';
import { MARK_GROUP } from '../../icons.gen';
import { MIXED_HINT } from '../Field/mixedHint';
import { IconPicker } from './IconPicker';
import s from './IconAttrField.module.css';

/** The value a field writes: a bare name with no mark, and `{ name, mark }` with one. */
const specOf = (name: string, mark: string | undefined): string | IconSpec =>
  mark === undefined ? name : (toIconSpec({ name, mark }) ?? name);

/** An icon by qualified name, with a mark set in its corner: the one held, and dialogs to choose another subject
 *  from every one registered, or a mark from the marks. Writes a name as a string, a name with a mark as
 *  `{ name, mark }`, and `undefined` to clear. `mixed` says the selection holds several icons, and `value` is then
 *  ignored. */
export function IconAttrField({ value, mixed = false, onChange }: {
  value: unknown;
  mixed?: boolean;
  onChange: (next: string | IconSpec | undefined) => void;
}) {
  const [open, setOpen] = useState<'name' | 'mark' | undefined>(undefined);
  const raw = mixed ? undefined : value;
  const held = typeof raw === 'string' ? raw
    : typeof raw === 'object' && raw !== null && typeof (raw as { name?: unknown }).name === 'string'
      ? (raw as { name: string }).name : undefined;
  const mark = held === undefined ? undefined : iconParts(toIconSpec(raw))?.mark;
  const glyph = useIconGlyph(held);
  const { state } = useIconVariant('all');
  const unregistered = held !== undefined && glyph === undefined && (state === 'loaded' || state === 'unknown');
  const shown = unregistered ? undefined : toIconRef(held);
  return (
    <div className={s.field}>
      <div className={s.bar}>
        {shown !== undefined && <Icon name={shown} mark={mark} size={20} />}
        <Button size="sm" onClick={() => setOpen('name')}>Select icon</Button>
        <Button size="sm" disabled={held === undefined && !mixed} onClick={() => onChange(undefined)}>No icon</Button>
      </div>
      {!mixed && held !== undefined && (
        <div className={s.bar}>
          <Button size="sm" onClick={() => setOpen('mark')}>{mark === undefined ? 'Add mark' : 'Change mark'}</Button>
          <Button size="sm" disabled={mark === undefined} onClick={() => onChange(held)}>No mark</Button>
        </div>
      )}
      {mixed ? <span className={s.current}>{MIXED_HINT}</span>
        : held !== undefined && (
          <span className={s.current}>
            {mark === undefined ? held : `${held} + ${mark}`}
            {unregistered && <span className={s.unregistered}>Not registered</span>}
          </span>
        )}
      <Dialog isOpen={open !== undefined} onOpenChange={(o) => { if (!o) setOpen(undefined); }}
        title={open === 'mark' ? 'Select mark' : 'Select icon'}>
        {open === 'mark'
          ? <IconPicker value={mark} group={MARK_GROUP} onChange={(next) => { onChange(specOf(held!, next)); setOpen(undefined); }} />
          : <IconPicker value={held} onChange={(next) => { onChange(specOf(next, mark)); setOpen(undefined); }} />}
      </Dialog>
    </div>
  );
}
