import { useId, useState, type KeyboardEvent } from 'react';
import { isOneChar } from '@weasel-js/registry';
import { EMPTY_TYPEAHEAD, rovingKey, typeaheadStep, type ListShape, type TypeaheadShape } from '@weasel-js/ui-input';
import s from './UiInputDemo.module.css';

type Row = { name: string; heading?: boolean };

const ROWS: Row[] = [
  { name: 'Fruit', heading: true },
  { name: 'apple' }, { name: 'apricot' }, { name: 'banana' }, { name: 'cherry' },
  { name: 'Vegetables', heading: true },
  { name: 'beet' }, { name: 'carrot' }, { name: 'celery' }, { name: 'chard' },
];

/** Headings are in the list but the highlight never lands on one. */
const SHAPE: ListShape<Row> & TypeaheadShape<Row> = { canStop: (r) => !r.heading, label: (r) => r.name };

/** The list is drawn here by hand; only what a key does to it comes from the package. */
export function UiInputDemo() {
  const id = useId();
  const [at, setAt] = useState<number | null>(null);
  const [typed, setTyped] = useState(EMPTY_TYPEAHEAD);
  const [last, setLast] = useState('—');

  const onKeyDown = (e: KeyboardEvent) => {
    const roved = rovingKey(ROWS, at, e.key, SHAPE);
    if (roved.handled) {
      e.preventDefault();
      setAt(roved.at);
      setLast(`rovingKey('${e.key}') → ${roved.at}`);
      return;
    }
    if (!isOneChar(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    const t = typeaheadStep(ROWS, at, typed, e.key, e.timeStamp, SHAPE);
    setTyped(t.buffer);
    if (t.hit !== null) setAt(t.hit);
    setLast(`typeaheadStep('${t.buffer.text}') → ${t.hit}`);
  };

  return (
    <div className={s.demo}>
      <ul
        className={s.list}
        role="listbox"
        aria-label="Produce"
        tabIndex={0}
        aria-activedescendant={at === null ? undefined : `${id}-${at}`}
        onKeyDown={onKeyDown}
      >
        {ROWS.map((row, i) =>
          row.heading ? (
            <li key={row.name} role="presentation" className={s.heading}>{row.name}</li>
          ) : (
            <li
              key={row.name}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === at}
              className={i === at ? `${s.row} ${s.at}` : s.row}
              onPointerDown={() => setAt(i)}
            >
              {row.name}
            </li>
          ),
        )}
      </ul>
      <p className={s.last} aria-live="polite">{last}</p>
    </div>
  );
}
