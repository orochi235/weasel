import { printValue } from './schemaExport';
import type { UndescribedValue } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** The values the app stores that no leaf describes yet, each a way to add the leaf that would. */
export function StoredList({ entries, onPick }: { entries: readonly UndescribedValue[]; onPick(entry: UndescribedValue): void }) {
  if (entries.length === 0) return <p className={s.storedEmpty}>Nothing unplaced: every stored value has a leaf.</p>;
  return (
    <ul className={s.storedList} aria-label="Stored values with no leaf">
      {entries.map((entry) => (
        <li key={entry.path}>
          <button type="button" className={s.storedEntry} onClick={() => onPick(entry)}
            aria-label={`Add a leaf for ${entry.path}`}>
            <span className={s.storedPath}>{entry.path}</span>
            <span className={s.storedValue}>{printValue(entry.value).replace(/\s*\n\s*/g, ' ')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
