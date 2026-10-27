import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useIconGlyph, useIconVariant } from '@weasel-js/core';
import { Button } from '../Button';
import { Input } from '../Input';
import { Icon } from '../../icons/Icon';
import { groupIcons, pageIndex, stepIndex } from './iconPickerModel';
import { MIXED_HINT } from '../mixedHint';
import s from './IconAttrField.module.css';

/** Picks an icon from every one registered, by qualified name. Writes the name as a string, and `undefined` to clear.
 *  `mixed` says the selection holds several icons, and `value` is then ignored. */
export function IconAttrField({ value, mixed = false, onChange }: {
  value: string | undefined;
  mixed?: boolean;
  onChange: (next: string | undefined) => void;
}) {
  const base = useId();
  const optionId = (ref: string) => `${base}-${ref.replace(/\W/g, '_')}`;
  const { entries, state } = useIconVariant('all');
  const held = mixed ? undefined : value;
  const glyph = useIconGlyph(held);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | undefined>(undefined);
  const list = useRef<HTMLDivElement>(null);
  const groups = groupIcons(entries, query);
  const flat = groups.flatMap((g) => g.entries);
  const current = flat.find((e) => e.ref === active) ?? flat.find((e) => e.ref === held) ?? flat[0];
  const loading = state === 'loading' || state === 'idle';
  const unregistered = held !== undefined && glyph === undefined && (state === 'loaded' || state === 'unknown');

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!current) return;
    if (e.key === 'Enter') { e.preventDefault(); onChange(current.ref); return; }
    const cells = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const boxes = cells.map((c) => c.getBoundingClientRect());
    const from = flat.indexOf(current);
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? flat.length - 1
      : pageIndex(boxes, from, e.key, list.current?.clientHeight ?? 0) ?? stepIndex(boxes, from, e.key);
    if (next === null) return;
    e.preventDefault();
    setActive(flat[next]!.ref);
    cells[next]?.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <div className={s.picker}>
      <div className={s.bar}>
        <Input type="search" aria-label="Search icons" placeholder="Search icons" value={query} onChange={setQuery} />
        <Button size="sm" onClick={() => onChange(undefined)}>No icon</Button>
      </div>
      {mixed ? <span className={s.current}>{MIXED_HINT}</span>
        : held !== undefined && (
          <span className={s.current}>
            {held}
            {unregistered && <span className={s.unregistered}>Not registered</span>}
          </span>
        )}
      {loading ? <span className={s.note}>Loading icons…</span>
        : state === 'failed' ? <span className={s.note}>Icons failed to load</span>
        : flat.length === 0 ? <span className={s.note}>No icons found</span>
        : (
          <div ref={list} className={s.list} role="listbox" aria-label="Icons" tabIndex={0}
            aria-activedescendant={current ? optionId(current.ref) : undefined} onKeyDown={onKeyDown}>
            {groups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group} className={s.group}>
                <div className={s.heading} aria-hidden="true">{g.group}</div>
                <div className={s.grid}>
                  {g.entries.map((e) => (
                    <div key={e.ref} id={optionId(e.ref)} role="option" aria-label={e.ref} title={e.ref}
                      aria-selected={e.ref === held}
                      className={`${s.cell} ${e.ref === held ? s.chosen : ''} ${e.ref === current?.ref ? s.active : ''}`}
                      onClick={() => { setActive(e.ref); onChange(e.ref); }}>
                      <Icon name={e.ref} size={20} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
