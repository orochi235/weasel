import { isByAxis, type ThemeDefinition } from '@weasel-js/theme';
import {
  DEFAULT_CONSTRAINTS,
  declaredSteps,
  generate,
  type CategoricalRampDef,
  type Constraints,
  type LightnessRampDef,
  type Lookup,
  type RampDef,
} from '@weasel-js/theme/engine';
import { Button, Dialog, PropertyGroup, PropertyPanel, SliderRow } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnchorList } from '../AnchorList';
import { PinIcon } from '../PinIcon';
import styles from '../ThemeEditor.module.css';
import { ConstraintsPanel, type SetConstraint } from '../palette/ConstraintsPanel';
import { unmetGates } from '../palette/unmetGates';
import type { DerivedDraft } from '../theme/draft';
import { describeIssue } from '../theme/issues';
import { adoptGenerated, removePin, setPin, setRamp } from '../theme/model';
import { rampView, readParam, writeParam, type StepView } from '../theme/ramps';

export interface RampsLayerProps {
  readonly draft: ThemeDefinition;
  readonly derived: DerivedDraft;
  readonly lookup: Lookup;
  readonly highlight: readonly string[];
  /** The ramp the preview compares pinned against generated. */
  readonly focused: string | null;
  readonly onFocus: (ramp: string | null) => void;
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

const PARAMS = [
  { key: 'lightness.0', label: 'First L', min: 0, max: 1, step: 0.001, digits: 3 },
  { key: 'lightness.1', label: 'Last L', min: 0, max: 1, step: 0.001, digits: 3 },
  { key: 'curve', label: 'Curve', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'hue', label: 'Hue', min: 0, max: 360, step: 1, digits: 0 },
  { key: 'chroma.peak', label: 'Chroma peak', min: 0, max: 0.37, step: 0.0005, digits: 4 },
  { key: 'chroma.lightBias', label: 'Light bias', min: 0, max: 2, step: 0.01, digits: 2 },
  { key: 'chroma.darkBias', label: 'Dark bias', min: 0, max: 2, step: 0.01, digits: 2 },
] as const;

function Swatch({ hex, caption }: { hex: string; caption?: string }) {
  return (
    <span className={styles.swatchCell}>
      <span className={styles.swatch} style={{ background: hex }} title={hex} />
      <code className={styles.hex}>{hex}</code>
      {caption !== undefined && <span className={styles.metric}>{caption}</span>}
    </span>
  );
}

type Edit = RampsLayerProps['onChange'];

function LightnessParams({ name, entry, draft, lookup, onChange }: { name: string; entry: LightnessRampDef; draft: ThemeDefinition; lookup: Lookup; onChange: Edit }) {
  const anchored = entry.anchor !== undefined;
  return (
    <PropertyPanel title={`${name} parameters`}>
      <PropertyGroup title="Walk">
        {PARAMS.filter((p) => !(anchored && (p.key === 'hue' || p.key === 'chroma.peak'))).map((p) => {
          const raw = readParam(entry, p.key);
          if (raw !== undefined && typeof raw !== 'number') {
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
              value={raw ?? 0}
              min={p.min}
              max={p.max}
              step={p.step}
              format={(v) => v.toFixed(p.digits)}
              onChange={(v) => onChange(setRamp(draft, lookup, name, (e) => writeParam(e as LightnessRampDef, p.key, v)), `ramps.${name}.${p.key}`)}
            />
          );
        })}
        {anchored && <p className={styles.paramNote}>Hue and chroma peak come from the anchor.</p>}
      </PropertyGroup>
    </PropertyPanel>
  );
}

function GatesEditor({ name, entry, draft, lookup, onChange }: { name: string; entry: CategoricalRampDef; draft: ThemeDefinition; lookup: Lookup; onChange: Edit }) {
  const c = useMemo<Constraints>(() => {
    const gates = isByAxis(entry.gates) ? {} : Object.fromEntries(Object.entries(entry.gates ?? {}).filter(([, v]) => !isByAxis(v)));
    return { ...DEFAULT_CONSTRAINTS, ...gates, count: declaredSteps(entry).length, anchors: entry.anchors ?? [] } as Constraints;
  }, [entry]);
  const palette = useMemo(() => generate(c), [c]);
  if (isByAxis(entry.gates)) {
    return <p className={styles.paramNote}>{name}&apos;s gates vary by {entry.gates.by}; edit them in the definition file.</p>;
  }
  const edit = (update: (e: CategoricalRampDef) => CategoricalRampDef, key: string) =>
    onChange(setRamp(draft, lookup, name, (e) => update(e as CategoricalRampDef) as RampDef), key);
  const setGate: SetConstraint = (key, value) => edit((e) => ({ ...e, gates: { ...(e.gates as object | undefined), [key]: value } as CategoricalRampDef['gates'] }),`ramps.${name}.gates.${String(key)}`);
  const unmet = palette.feasible ? [] : unmetGates(c, palette.stats);
  return (
    <div className={styles.gates}>
      <PropertyPanel title={`${name} gates`}>
        <ConstraintsPanel c={c} onSet={setGate} fixedCount />
        <AnchorList anchors={c.anchors} onChange={(anchors) => edit((e) => ({ ...e, anchors }), `ramps.${name}.anchors`)} />
      </PropertyPanel>
      {!palette.feasible && (
        <p role="status" className={styles.status}>
          <strong>No arrangement satisfies these gates.</strong> {unmet.join('; ') || 'Loosen a gate.'}
        </p>
      )}
    </div>
  );
}

export function RampsLayer({ draft, derived, lookup, highlight, focused, onFocus, onChange }: RampsLayerProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editingGates, setEditingGates] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);

  const ramps = Object.entries(derived.merged.ramps ?? {});
  if (ramps.length === 0) return <p className={styles.empty}>{draft.name} has no ramps.</p>;

  const adopt = (ramp: string) => onChange(adoptGenerated(draft, lookup, ramp), `adopt:${ramp}`, `adopt generated ${ramp}`);
  // weasel's own ramps feed every surface the visual baselines record.
  const requestAdopt = (ramp: string) => (draft.name === 'weasel' ? setConfirming(ramp) : adopt(ramp));
  const ownPin = (token: string) => Object.hasOwn(draft.pins ?? {}, token);
  const allIssues = derived.views.flatMap((v) => v.result.issues);
  const issuesOf = (name: string) => {
    const prefix = `ramps.${name}`;
    const own = allIssues.filter((i) =>
      i.kind === 'infeasible-ramp' ? i.ramp === name : 'path' in i && (i.path === prefix || i.path.startsWith(`${prefix}.`)),
    );
    return [...new Set(own.map(describeIssue))];
  };
  const togglePin = (s: StepView) =>
    s.pinned
      ? onChange(removePin(draft, s.token), `pin:${s.token}`, `unpin ${s.token}`)
      : onChange(setPin(draft, s.token, { value: s.hex, type: 'color' }), `pin:${s.token}`, `pin ${s.token}`);

  return (
    <div ref={ref} className={styles.ramps}>
      {ramps.map(([name, entry]) => {
        const view = rampView(name, entry, derived.primary.result, derived.primary.resolved);
        const lit = (token: string) => highlight.includes(token);
        const issues = issuesOf(name);
        const authored = view.steps.some((s) => derived.primary.result.provenance[s.token]?.layer === 'pins');
        return (
          <section key={name} className={focused === name ? `${styles.ramp} ${styles.rampFocused}` : styles.ramp} aria-label={`${name} ramp`}>
            <header className={styles.rampHeader}>
              <h3 className={styles.rampTitle}>{name}</h3>
              <span className={styles.metric}>{view.kind}</span>
              {view.spread !== null && <span className={styles.metric}>spread {view.spread.toFixed(2)}×</span>}
              {view.anyPinned && view.generatedSpread !== null && <span className={styles.metric}>generated {view.generatedSpread.toFixed(2)}×</span>}
              <span className={styles.rampActions}>
                {view.anyPinned && (
                  <Button size="sm" pressed={focused === name} onClick={() => onFocus(focused === name ? null : name)}>
                    Compare in preview
                  </Button>
                )}
                <Button size="sm" disabled={!view.steps.some((s) => s.pinned && ownPin(s.token))} onClick={() => requestAdopt(name)}>
                  Adopt generated
                </Button>
                {entry.kind === 'categorical' && (
                  <Button size="sm" pressed={editingGates === name} onClick={() => setEditingGates(editingGates === name ? null : name)}>
                    Edit gates
                  </Button>
                )}
              </span>
            </header>
            {issues.length > 0 && (
              <div role="status" className={styles.status}>
                <ul className={styles.issues}>
                  {issues.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.tableScroll}>
              <table className={styles.strip}>
                <tbody>
                  <tr>
                    <th scope="row">{authored ? 'Authored' : view.anyPinned ? 'Pinned' : 'Generated'}</th>
                    {view.steps.map((s) => (
                      <td key={s.step} className={lit(s.token) ? styles.highlight : undefined} data-highlight={lit(s.token) || undefined}>
                        <Swatch hex={s.hex} caption={s.step} />
                      </td>
                    ))}
                  </tr>
                  {view.anyPinned && !authored && (
                    <tr>
                      <th scope="row">Generated</th>
                      {view.steps.map((s) => (
                        <td key={s.step}>{s.generated !== undefined ? <Swatch hex={s.generated} /> : <span className={styles.metric}>—</span>}</td>
                      ))}
                    </tr>
                  )}
                  {entry.kind === 'lightness' && (
                    <>
                      <tr>
                        <th scope="row">L</th>
                        {view.steps.map((s) => (
                          <td key={s.step} className={styles.num}>{s.L.toFixed(3)}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">ΔL</th>
                        <td />
                        {view.dL.map((d, i) => (
                          <td key={view.steps[i + 1].step} className={styles.num}>{d.toFixed(3)}</td>
                        ))}
                      </tr>
                    </>
                  )}
                  <tr>
                    <th scope="row">Pin</th>
                    {view.steps.map((s) => (
                      <td key={s.step}>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          ariaLabel={`${s.pinned ? 'Unpin' : 'Pin'} ${s.token}`}
                          pressed={s.pinned}
                          disabled={s.pinned && !ownPin(s.token)}
                          onClick={() => togglePin(s)}
                        >
                          <PinIcon />
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {entry.kind === 'lightness' && <LightnessParams name={name} entry={entry} draft={draft} lookup={lookup} onChange={onChange} />}
            {entry.kind === 'categorical' && editingGates === name && <GatesEditor name={name} entry={entry} draft={draft} lookup={lookup} onChange={onChange} />}
          </section>
        );
      })}
      <Dialog
        isOpen={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        role="alertdialog"
        title="Adopt the generated ramp?"
        footer={
          <>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (confirming !== null) adopt(confirming);
                setConfirming(null);
              }}
            >
              Adopt
            </Button>
          </>
        }
      >
        <p>
          This removes the pins on every {confirming} step, so each takes its generated color. Every surface that reads them moves, and the
          visual baselines have to be re-recorded.
        </p>
      </Dialog>
    </div>
  );
}
