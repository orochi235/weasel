import { useState, type ReactNode } from 'react';
import type { PrefMap } from '@weasel-js/prefs';
import { Input } from '../Input';
import { ListEditor } from '../ListEditor';
import s from './MapEditor.module.css';

type Pair = readonly [key: string, value: unknown];

const NONE: Readonly<Record<string, unknown>> = {};

/** What `pairs` store as: an entry not yet given a key is left out, and of two with one key the later wins. */
function recordOf(pairs: readonly Pair[]): Record<string, unknown> {
  return Object.fromEntries(pairs.filter(([key]) => key !== ''));
}

function holds(record: Readonly<Record<string, unknown>>, pairs: readonly Pair[]): boolean {
  const mine = Object.entries(recordOf(pairs));
  const theirs = Object.entries(record);
  return mine.length === theirs.length && mine.every(([k, v], i) => theirs[i]![0] === k && Object.is(theirs[i]![1], v));
}

/** Props for {@link MapEditor}. */
export interface MapEditorProps {
  pref: PrefMap;
  value: unknown;
  /** Every edit, add and removal, with the whole record. */
  onChange: (next: Record<string, unknown>) => void;
  /** Draws one entry's value as the map's `item` leaf, named `name` for assistive tech. */
  renderValue: (value: unknown, set: (next: unknown) => void, name: string, key: string) => ReactNode;
}

/**
 * A `map` leaf's entries: a key field and the item's control per entry, a remove button beside each, and an add
 * button under them. An entry being typed keeps its row while its key is empty or repeats another, though the
 * record written holds neither.
 */
export function MapEditor({ pref, value, onChange, renderValue }: MapEditorProps) {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : NONE;
  const [pairs, setPairs] = useState<readonly Pair[]>(() => Object.entries(record));
  const [seen, setSeen] = useState(record);
  if (seen !== record) {
    setSeen(record);
    // Written from outside: the rows follow. Our own write coming back leaves the rows being typed alone.
    if (!holds(record, pairs)) setPairs(Object.entries(record));
  }
  const { item } = pref;
  const label = item.name || pref.name;
  return (
    <ListEditor<Pair>
      aria-label={label}
      value={pairs}
      onChange={(next) => {
        setPairs(next);
        onChange(recordOf(next));
      }}
      newEntry={() => ['', item.default]}
      renderEntry={([key, held], set, name) => (
        <div className={s.entry}>
          <Input aria-label={`${name} key`} className={s.key} placeholder="Key" value={key} onChange={(next) => set([next, held])} />
          <div className={s.value}>
            {renderValue(held !== undefined ? held : item.default, (next) => set([key, next]), key === '' ? name : `${label} ${key}`, key)}
          </div>
        </div>
      )}
    />
  );
}
