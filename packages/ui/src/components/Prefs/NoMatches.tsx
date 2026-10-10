import s from './Prefs.module.css';

/** What a filter matching nothing leaves behind. */
export function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className={s.noMatches}>
      <p>No settings match “{query.trim()}”.</p>
      <button type="button" className={s.clearFilter} onClick={onClear}>
        Clear filter
      </button>
    </div>
  );
}
