import s from './KeyCap.module.css';

function keyKind(p: string): 'modifier' | 'wide' | 'square' {
  if (p === '⌘' || p === '⇪' || p === '⌥' || p === '⌃') return 'modifier';
  if (p === '⇥' || p === '↵' || p === '␣') return 'wide';
  return 'square';
}

/** Renders a shortcut as a row of bordered keycap chips, one per glyph
 *  (modifiers + key). Empty / undefined renders as a muted em-dash. Used by
 *  the ToolkitBuilder action table and the Bundle Inspector's action detail. */
export function KeyCap({ parts }: { parts: readonly string[] | undefined }) {
  if (!parts || parts.length === 0) return <span className={s.keysEmpty}>—</span>;
  return (
    <span className={s.keys}>
      {parts.map((p, i) => (
        <kbd key={i} className={s.key} data-kind={keyKind(p)}>{p}</kbd>
      ))}
    </span>
  );
}
