import s from './Prefs.module.css';

/** What a filter matching nothing leaves behind. Nothing without a query: the schema itself had nothing to draw. */
export function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  if (query.trim() === '') return null;
  return (
    <div className={s.noMatches}>
      <p>No settings match “{query.trim()}”.</p>
      <button type="button" className={s.clearFilter} onClick={onClear}>
        Clear filter
      </button>
    </div>
  );
}
