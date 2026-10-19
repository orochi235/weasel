/** A serialized value as a reader expects to see it: tagged maps, sets and typed arrays named, functions and cycles marked. */
import { useState, type ReactElement, type ReactNode } from 'react';
import type { SerializedValue } from '@weasel-js/core/devtools-protocol';
import { Disclosure } from '@weasel-js/ui/components/Disclosure';
import s from './ValueView.module.css';

type Obj = { [key: string]: SerializedValue };

const isObj = (v: SerializedValue): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The children a container lists, or null for a value shown on one line. */
function entriesOf(v: SerializedValue): [string, SerializedValue][] | null {
  if (Array.isArray(v)) return v.map((x, i) => [String(i), x]);
  if (!isObj(v)) return null;
  if (v.$type === 'Map' || v.$type === 'Set') {
    const items = Array.isArray(v.entries) ? v.entries : [];
    return items.map((x, i) => [String(i), x]);
  }
  if (typeof v.$type === 'string') return null;
  return Object.entries(v).filter(([k]) => k !== '$class');
}

/** What a container is called on its own row: `Array(3)`, `Map(2)`, `Path {…}`. */
function summaryOf(v: SerializedValue): string {
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (!isObj(v)) return '';
  if (v.$type === 'Map' || v.$type === 'Set') return `${v.$type}(${String(v.size)})`;
  const name = typeof v.$class === 'string' ? v.$class : '';
  return Object.keys(v).length === 0 ? `${name}{}` : `${name ? `${name} ` : ''}{…}`;
}

function Scalar({ value }: { value: SerializedValue }): ReactElement {
  if (value === undefined) return <span className={s.muted}>undefined</span>;
  if (value === null) return <span className={s.keyword}>null</span>;
  if (typeof value === 'number') return <span className={s.number}>{value}</span>;
  if (typeof value === 'boolean') return <span className={s.keyword}>{String(value)}</span>;
  if (typeof value === 'string') {
    if (value.startsWith('ƒ ')) return <span className={s.fn}>{value}</span>;
    if (value === '[cycle]' || value === '…' || value.startsWith('… ')) return <span className={s.muted}>{value}</span>;
    return <span className={s.string}>{JSON.stringify(value)}</span>;
  }
  if (isObj(value) && value.$type === 'Date') return <span className={s.tag}>Date {String(value.value)}</span>;
  if (isObj(value) && typeof value.$type === 'string') {
    return <span className={s.tag}>{value.$type}({String(value.length)})</span>;
  }
  return <span className={s.muted}>{summaryOf(value)}</span>;
}

function Entry({ name, value, depth }: { name: ReactNode; value: SerializedValue; depth: number }): ReactElement {
  const entries = entriesOf(value);
  const [open, setOpen] = useState(depth < 2);
  if (!entries || entries.length === 0) {
    return (
      <div className={s.row}>
        <span className={s.key}>{name}</span>
        <Scalar value={value} />
      </div>
    );
  }
  return (
    <div>
      <div className={s.row}>
        <Disclosure open={open} onToggle={() => setOpen((o) => !o)} label={`${String(name)} ${summaryOf(value)}`} size={11} />
        <span className={s.key}>{name}</span>
        <span className={s.muted}>{summaryOf(value)}</span>
      </div>
      {open && (
        <div className={s.children}>
          {entries.map(([k, v]) => <Entry key={k} name={k} value={v} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export interface ValueViewProps {
  value: SerializedValue;
  /** Names the value for a screen reader. */
  label: string;
}

/** `value` as nested rows, its containers folding; the top level lists its entries directly. */
export function ValueView({ value, label }: ValueViewProps): ReactElement {
  const entries = entriesOf(value);
  return (
    <div className={s.value} role="group" aria-label={label}>
      {entries && entries.length > 0
        ? entries.map(([k, v]) => <Entry key={k} name={k} value={v} depth={1} />)
        : <Scalar value={value} />}
    </div>
  );
}
