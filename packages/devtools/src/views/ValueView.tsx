/** A serialized value as a reader expects to see it: tagged values named, containers folding, cuts and cycles marked. */
import { useState, type ReactElement, type ReactNode } from 'react';
import { unescapeKey, type SerializedValue } from '@weasel-js/core/devtools-protocol';
import { Disclosure } from '@weasel-js/ui/components/Disclosure';
import s from './ValueView.module.css';

type Obj = { [key: string]: SerializedValue };

const isObj = (v: SerializedValue): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const tagOf = (v: SerializedValue): string | null => (isObj(v) && typeof v.$type === 'string' ? v.$type : null);

/** The row that stands for entries cut past the item limit. */
const moreRow = (count: SerializedValue): [string, SerializedValue] => ['…', { $type: 'more', count }];

/** An array's rows, a `more` tag at its end named `…` rather than by index. */
const listed = (items: readonly SerializedValue[]): [string, SerializedValue][] =>
  items.map((x, i) => [tagOf(x) === 'more' ? '…' : String(i), x]);

/** The children a container lists, or null for a value shown on one line. */
function entriesOf(v: SerializedValue): [string, SerializedValue][] | null {
  if (Array.isArray(v)) return listed(v);
  if (!isObj(v)) return null;
  const tag = tagOf(v);
  if (tag === 'Map' || tag === 'Set') return listed(Array.isArray(v.entries) ? v.entries : []);
  if (tag !== null) return null;
  const rows: [string, SerializedValue][] = [];
  for (const [key, value] of Object.entries(v)) {
    const name = unescapeKey(key);
    if (name !== null) rows.push([name, value]);
  }
  if (v.$more !== undefined) rows.push(moreRow(v.$more));
  return rows;
}

/** What a container is called on its own row: `Array(3)`, `Map(2)`, `Path {…}`. */
function summaryOf(v: SerializedValue): string {
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (!isObj(v)) return '';
  if (v.$type === 'Map' || v.$type === 'Set') return `${v.$type}(${String(v.size)})`;
  const name = typeof v.$class === 'string' ? v.$class : '';
  return (entriesOf(v)?.length ?? 0) === 0 ? `${name}{}` : `${name ? `${name} ` : ''}{…}`;
}

/** A tagged value on one line, or null for a tag that is a container. */
function taggedScalar(v: Obj, tag: string): ReactNode {
  switch (tag) {
    case 'number': return <span className={s.number}>{String(v.value)}</span>;
    case 'bigint': return <span className={s.number}>{String(v.value)}n</span>;
    case 'symbol': return <span className={s.keyword}>{String(v.value)}</span>;
    case 'function': return <span className={s.fn}>ƒ {String(v.name)}</span>;
    case 'cycle': return <span className={s.muted}>[cycle]</span>;
    case 'threw': return <span className={s.muted}>[threw: {String(v.value)}]</span>;
    case 'depth': return <span className={s.muted}>…</span>;
    case 'more': return <span className={s.muted}>… {String(v.count)} more</span>;
    case 'Date': return <span className={s.tag}>Date {String(v.value)}</span>;
    case 'Map':
    case 'Set': return null;
    default: return <span className={s.tag}>{tag}({String(v.length)})</span>;
  }
}

function Scalar({ value }: { value: SerializedValue }): ReactElement {
  if (value === undefined) return <span className={s.muted}>undefined</span>;
  if (value === null) return <span className={s.keyword}>null</span>;
  if (typeof value === 'number') return <span className={s.number}>{value}</span>;
  if (typeof value === 'boolean') return <span className={s.keyword}>{String(value)}</span>;
  if (typeof value === 'string') return <span className={s.string}>{JSON.stringify(value)}</span>;
  const tag = tagOf(value);
  const shown = tag !== null && isObj(value) ? taggedScalar(value, tag) : null;
  return <>{shown ?? <span className={s.muted}>{summaryOf(value)}</span>}</>;
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
