import { useEffect, useRef } from 'react';
import styles from './ThemeEditor.module.css';
import type { TokenRow } from './theme/rows';

export interface TokenListProps {
  readonly rows: readonly TokenRow[];
  /** Tokens click-to-inspect jumped to; the first highlighted row is scrolled into view. */
  readonly highlight: readonly string[];
  readonly empty: string;
}

export function TokenList({ rows, highlight, empty }: TokenListProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <div ref={ref} className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Type</th>
            <th scope="col">Value</th>
            <th scope="col">Replaced</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lit = highlight.includes(row.name);
            return (
              <tr key={row.name} className={lit ? styles.highlight : undefined} data-highlight={lit || undefined}>
                <td><code>{row.name}</code></td>
                <td>{row.type}</td>
                <td><code>{row.value}</code></td>
                <td>{row.replaced !== undefined && <code>{row.replaced}</code>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
