import { useState } from 'react';
import { useIconGlyph, useIconVariant } from '@weasel-js/core';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Icon } from '../../icons/Icon';
import { MIXED_HINT } from '../mixedHint';
import { IconPicker } from './IconPicker';
import s from './IconAttrField.module.css';

/** An icon by qualified name: the one held, and a dialog to choose another from every one registered. Writes the
 *  name as a string, and `undefined` to clear. `mixed` says the selection holds several icons, and `value` is then
 *  ignored. */
export function IconAttrField({ value, mixed = false, onChange }: {
  value: string | undefined;
  mixed?: boolean;
  onChange: (next: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const held = mixed ? undefined : value;
  const glyph = useIconGlyph(held);
  const { state } = useIconVariant('all');
  const unregistered = held !== undefined && glyph === undefined && (state === 'loaded' || state === 'unknown');
  return (
    <div className={s.field}>
      <div className={s.bar}>
        {held !== undefined && !unregistered && <Icon name={held} size={20} />}
        <Button size="sm" onClick={() => setOpen(true)}>Select icon</Button>
        <Button size="sm" disabled={held === undefined && !mixed} onClick={() => onChange(undefined)}>No icon</Button>
      </div>
      {mixed ? <span className={s.current}>{MIXED_HINT}</span>
        : held !== undefined && (
          <span className={s.current}>
            {held}
            {unregistered && <span className={s.unregistered}>Not registered</span>}
          </span>
        )}
      <Dialog isOpen={open} onOpenChange={setOpen} title="Select icon">
        <IconPicker value={held} onChange={(next) => { onChange(next); setOpen(false); }} />
      </Dialog>
    </div>
  );
}
