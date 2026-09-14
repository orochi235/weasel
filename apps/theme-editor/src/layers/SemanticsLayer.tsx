import type { ThemeDefinition } from '@weasel-js/theme';
import { declaredSteps, type Lookup } from '@weasel-js/theme/engine';
import { Button } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../ThemeEditor.module.css';
import type { DerivedDraft } from '../theme/draft';
import { describeIssue } from '../theme/issues';
import { removePin, setSemantic } from '../theme/model';
import { semanticRows } from '../theme/semantics';
import { SemanticDrawer } from './SemanticDrawer';

export interface SemanticsLayerProps {
  readonly draft: ThemeDefinition;
  readonly derived: DerivedDraft;
  readonly lookup: Lookup;
  readonly highlight: readonly string[];
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

export function SemanticsLayer({ draft, derived, highlight, onChange }: SemanticsLayerProps) {
  const rows = useMemo(() => semanticRows(draft, derived.merged, derived.views), [draft, derived]);
  const ramps = useMemo(
    () => Object.fromEntries(Object.entries(derived.merged.ramps ?? {}).map(([name, entry]) => [name, declaredSteps(entry)])),
    [derived],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);

  if (rows.length === 0) return <p className={styles.empty}>{draft.name} has no semantics.</p>;

  const modes = derived.views.map((v) => v.mode);
  const revert = (name: string) => onChange(removePin(draft, name), `pin:${name}`, `revert ${name}`);
  const open = rows.find((r) => r.name === selected);
  const issuesOf = (name: string) => {
    const prefix = `semantics.${name}`;
    const own = derived.views
      .flatMap((v) => v.result.issues)
      .filter((i) =>
        i.kind === 'contrast-unmet' || i.kind === 'check-failed'
          ? i.token === name
          : 'path' in i && (i.path === prefix || i.path.startsWith(`${prefix}.`)),
      );
    return [...new Set(own.map(describeIssue))];
  };

  return (
    <div ref={ref} className={styles.semantics}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Swatch</th>
              <th scope="col">Token</th>
              <th scope="col">Rule</th>
              {modes.map((m) => (
                <th key={m ?? 'value'} scope="col">
                  {m ?? 'Step'}
                </th>
              ))}
              <th scope="col">Contrast</th>
              <th scope="col">Pin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lit = highlight.includes(r.name);
              const classes = [lit ? styles.highlight : '', selected === r.name ? styles.selectedRow : ''].filter(Boolean).join(' ');
              return (
                <tr key={r.name} className={classes || undefined} data-highlight={lit || undefined}>
                  <td>
                    <span className={styles.swatchPair}>
                      {r.cells.map((c) => (
                        <span
                          key={c.mode ?? 'value'}
                          className={styles.swatchSmall}
                          style={{ background: c.hex }}
                          title={`${c.mode ?? ''} ${c.hex}`.trim()}
                        />
                      ))}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.linkButton}
                      aria-expanded={selected === r.name}
                      onClick={() => setSelected(selected === r.name ? null : r.name)}
                    >
                      {r.name}
                    </button>
                  </td>
                  <td>
                    <code>{r.summary}</code>
                  </td>
                  {modes.map((m) => {
                    const cell = r.cells.find((c) => c.mode === m);
                    return (
                      <td key={m ?? 'value'}>
                        <code>{cell?.step ?? cell?.hex ?? '—'}</code>
                      </td>
                    );
                  })}
                  <td className={styles.num}>{r.worst ? `${r.worst.ratio.toFixed(2)} ${r.worst.pass ? 'pass' : 'fail'}` : '—'}</td>
                  <td>
                    {r.ownPin ? (
                      <Button size="sm" variant="ghost" ariaLabel={`Revert ${r.name}`} onClick={() => revert(r.name)}>
                        Revert
                      </Button>
                    ) : r.pinned ? (
                      <span className={styles.metric}>inherited</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (
        <SemanticDrawer
          key={open.name}
          name={open.name}
          rule={derived.merged.semantics![open.name]}
          row={open}
          modes={modes}
          ramps={ramps}
          semantics={rows.map((r) => r.name)}
          issues={issuesOf(open.name)}
          onRule={(rule, key) => onChange(setSemantic(draft, open.name, rule), key)}
          onRevert={() => revert(open.name)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
