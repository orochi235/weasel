import type { ThemeDefinition } from '@weasel-js/theme';
import type { Lookup, ScaleDef } from '@weasel-js/theme/engine';
import { Button, PropertyGroup, PropertyPanel, SliderRow } from '@weasel-js/ui';
import { useEffect, useMemo, useRef } from 'react';
import styles from '../ThemeEditor.module.css';
import type { DerivedDraft } from '../theme/draft';
import { setScale } from '../theme/model';
import { scaleTable } from '../theme/scales';

export interface ScalesLayerProps {
  readonly draft: ThemeDefinition;
  readonly derived: DerivedDraft;
  readonly lookup: Lookup;
  readonly highlight: readonly string[];
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

const PARAMS = [
  { key: 'base', label: 'Base', min: 0, max: 64, step: 1 },
  { key: 'step', label: 'Step', min: 0, max: 32, step: 1 },
  { key: 'ratio', label: 'Ratio', min: 1, max: 3, step: 0.01 },
] as const;

function ScaleSection({ name, entry, draft, lookup, highlight, onChange }: Omit<ScalesLayerProps, 'derived'> & { name: string; entry: ScaleDef }) {
  const table = useMemo(() => scaleTable(draft, lookup, name), [draft, lookup, name]);
  const own = Object.hasOwn(draft.scales ?? {}, name);
  const px = (v: string | undefined) => (v === undefined ? 0 : Number.parseFloat(v));
  const widest = Math.max(1, ...table.columns.flatMap((c) => Object.values(c.values).map(px)));
  return (
    <section className={styles.ramp} aria-label={`${name} scale`}>
      <header className={styles.rampHeader}>
        <h3 className={styles.rampTitle}>{name}</h3>
        <span className={styles.metric}>{entry.step !== undefined ? 'linear' : 'geometric'}</span>
        {!own && (
          <span className={styles.rampActions}>
            <Button size="sm" onClick={() => onChange(setScale(draft, lookup, name, (e) => e), `own:scales.${name}`, `make ${name} own`)}>
              Make {name} this theme&apos;s own
            </Button>
          </span>
        )}
      </header>
      {!own && (
        <p className={styles.paramNote}>
          {draft.name} inherits {name}. Making it this theme&apos;s own copies its parameters here, so later changes to the theme it extends stop
          reaching it.
        </p>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Step</th>
              {table.columns.map((c) => (
                <th key={c.label} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.steps.map((step) => {
              const token = `${name}-${step}`;
              const lit = highlight.includes(token);
              return (
                <tr key={step} className={lit ? styles.highlight : undefined} data-highlight={lit || undefined}>
                  <th scope="row">
                    <code>{token}</code>
                  </th>
                  {table.columns.map((c) => (
                    <td key={c.label} className={styles.ladderCell}>
                      <span className={styles.num}>{c.values[step]}</span>
                      <span className={styles.ladderBar} style={{ width: `${(px(c.values[step]) / widest) * 100}%` }} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PropertyPanel title={`${name} parameters`}>
        <PropertyGroup title="Scale">
          {PARAMS.map((p) => {
            const raw = entry[p.key];
            if (raw === undefined) return null;
            if (!own || typeof raw !== 'number') {
              return (
                <p key={p.key} className={styles.paramNote}>
                  {p.label}: <code>{JSON.stringify(raw)}</code>
                </p>
              );
            }
            return (
              <SliderRow
                key={p.key}
                label={p.label}
                value={raw}
                min={p.min}
                max={p.max}
                step={p.step}
                onChange={(v) => onChange(setScale(draft, lookup, name, (e) => ({ ...e, [p.key]: v })), `scales.${name}.${p.key}`)}
              />
            );
          })}
        </PropertyGroup>
      </PropertyPanel>
    </section>
  );
}

export function ScalesLayer({ draft, derived, lookup, highlight, onChange }: ScalesLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);
  const scales = Object.entries(derived.merged.scales ?? {});
  if (scales.length === 0) return <p className={styles.empty}>{draft.name} has no scales.</p>;
  return (
    <div ref={ref} className={styles.ramps}>
      {scales.map(([name, entry]) => (
        <ScaleSection key={name} name={name} entry={entry} draft={draft} lookup={lookup} highlight={highlight} onChange={onChange} />
      ))}
    </div>
  );
}
