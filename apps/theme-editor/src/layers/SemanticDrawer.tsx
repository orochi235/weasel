import { isByAxis, type AxisDefs, type Varying } from '@weasel-js/theme';
import type { SemanticRule } from '@weasel-js/theme/engine';
import { Button, CheckboxRow, NumberRow, PropertyGroup, PropertyPanel, SelectRow, TextRow, ToggleRow } from '@weasel-js/ui';
import { useState } from 'react';
import styles from '../ThemeEditor.module.css';
import { RULE_KINDS, defaultRule, ruleKind, type SemanticRowView } from '../theme/semantics';

type Ramps = Readonly<Record<string, readonly string[]>>;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface SemanticDrawerProps {
  readonly name: string;
  readonly rule: Varying<SemanticRule>;
  readonly row: SemanticRowView;
  /** The draft's axes, which may be newer than the last derivation. */
  readonly axes: AxisDefs;
  readonly ramps: Ramps;
  readonly semantics: readonly string[];
  /** Described issues this semantic's rule raised, in any mode. */
  readonly issues: readonly string[];
  readonly onRule: (rule: Varying<SemanticRule>, key: string) => void;
  readonly onRevert: () => void;
  readonly onClose: () => void;
}

const DIRECTIONS = [
  { value: 'lighter', label: 'Lighter' },
  { value: 'darker', label: 'Darker' },
  { value: 'away', label: 'Away' },
] as const;

const parseNames = (text: string) =>
  text
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

function AgainstRow({ against, onChange }: { against: readonly string[]; onChange: (against: string[]) => void }) {
  const [raw, setRaw] = useState(() => against.join(', '));
  const text = sameJson(parseNames(raw), against) ? raw : against.join(', ');
  return (
    <TextRow
      label="Against"
      value={text}
      onChange={(v) => {
        setRaw(v);
        onChange(parseNames(v));
      }}
    />
  );
}

function RuleFields({
  rule,
  ramps,
  semantics,
  onChange,
}: {
  rule: SemanticRule;
  ramps: Ramps;
  semantics: readonly string[];
  onChange: (next: SemanticRule, field: string) => void;
}) {
  const rampOptions = Object.keys(ramps).map((r) => ({ value: r, label: r }));
  if ('ref' in rule) {
    return (
      <>
        <TextRow label="Reference" value={rule.ref} onChange={(ref) => onChange({ ...rule, ref }, 'ref')} />
        <NumberRow label="Alpha" value={rule.alpha ?? null} min={0} max={1} step={0.01} onChange={(alpha) => onChange({ ...rule, alpha }, 'alpha')} />
        {rule.alpha !== undefined && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const { alpha: _alpha, ...opaque } = rule;
              onChange(opaque, 'alpha');
            }}
          >
            Clear alpha
          </Button>
        )}
      </>
    );
  }
  if ('contrast' in rule) {
    return (
      <>
        <SelectRow label="Ramp" value={rule.ramp} options={rampOptions} onChange={(ramp) => onChange({ ...rule, ramp }, 'ramp')} />
        <NumberRow
          label="Minimum"
          value={rule.contrast.min}
          min={1}
          max={21}
          step={0.1}
          onChange={(min) => onChange({ ...rule, contrast: { ...rule.contrast, min } }, 'contrast.min')}
        />
        <AgainstRow
          against={rule.contrast.against}
          onChange={(against) => onChange({ ...rule, contrast: { ...rule.contrast, against } }, 'contrast.against')}
        />
      </>
    );
  }
  if ('offset' in rule) {
    return (
      <>
        <SelectRow
          label="From"
          value={rule.from}
          options={semantics.map((s) => ({ value: s, label: s }))}
          onChange={(from) => onChange({ ...rule, from }, 'from')}
        />
        <NumberRow label="Offset" value={rule.offset} min={0} step={1} onChange={(offset) => onChange({ ...rule, offset }, 'offset')} />
        <ToggleRow label="Direction" value={rule.dir} options={DIRECTIONS} onChange={(dir) => onChange({ ...rule, dir }, 'dir')} />
      </>
    );
  }
  if ('step' in rule) {
    return (
      <>
        <SelectRow
          label="Ramp"
          value={rule.ramp}
          options={rampOptions}
          onChange={(ramp) => onChange({ ...rule, ramp, step: ramps[ramp]?.[0] ?? '' }, 'ramp')}
        />
        {isByAxis(rule.step) ? (
          <p className={styles.paramNote}>The step varies by {rule.step.by}; edit it in the definition file.</p>
        ) : (
          <SelectRow
            label="Step"
            value={rule.step}
            options={(ramps[rule.ramp] ?? []).map((s) => ({ value: s, label: s }))}
            onChange={(step) => onChange({ ...rule, step }, 'step')}
          />
        )}
      </>
    );
  }
  return <TextRow label="Value" value={String(rule.value)} onChange={(value) => onChange({ ...rule, value }, 'value')} />;
}

export function SemanticDrawer({ name, rule, row, axes, ramps, semantics, issues, onRule, onRevert, onClose }: SemanticDrawerProps) {
  const modeValues = Object.keys(axes.mode?.values ?? {});
  const varies = isByAxis(rule);
  const axis = varies ? rule.by : 'mode';
  const values = varies ? Object.keys(axes[rule.by]?.values ?? rule).filter((k) => k !== 'by') : modeValues;
  const [branch, setBranch] = useState(() => (varies ? values.find((v) => Object.hasOwn(rule, v)) : undefined) ?? values[0] ?? '');
  const current = (varies ? (rule as unknown as Record<string, unknown>)[branch] : rule) as Varying<SemanticRule> | undefined;
  const others = semantics.filter((n) => n !== name);
  const present = varies ? Object.entries(rule).find(([k]) => k !== 'by')?.[1] : undefined;

  const write = (next: SemanticRule, field: string) =>
    onRule(
      varies ? ({ ...(rule as object), [branch]: next } as Varying<SemanticRule>) : next,
      `semantics.${name}.${varies ? `${branch}.` : ''}${field}`,
    );
  const setVaries = (on: boolean) => {
    if (!current) return;
    onRule(
      on ? ({ by: 'mode', ...Object.fromEntries(modeValues.map((m) => [m, current])) } as Varying<SemanticRule>) : current,
      `semantics.${name}.by`,
    );
  };

  return (
    <aside className={styles.drawer} aria-label={`${name} rule`}>
      <header className={styles.rampHeader}>
        <h3 className={styles.rampTitle}>{name}</h3>
        <span className={styles.rampActions}>
          {row.ownPin && (
            <Button size="sm" onClick={onRevert}>
              Revert pin
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
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
      <PropertyPanel title="Rule">
        <PropertyGroup title="Kind">
          {(varies || modeValues.length > 1) && <CheckboxRow label={`Varies by ${axis}`} value={varies} onChange={setVaries} />}
          {varies && <ToggleRow label="Editing" value={branch} options={values.map((v) => ({ value: v, label: v }))} onChange={setBranch} />}
          {current !== undefined && !isByAxis(current) && (
            <SelectRow label="Rule" value={ruleKind(current)} options={RULE_KINDS} onChange={(kind) => write(defaultRule(kind, current, ramps, others), 'kind')} />
          )}
        </PropertyGroup>
        <PropertyGroup title="Fields">
          {current === undefined ? (
            <>
              <p className={styles.paramNote}>This rule has no {branch} branch.</p>
              {present !== undefined && (
                <Button size="sm" onClick={() => onRule({ ...(rule as object), [branch]: present } as Varying<SemanticRule>, `semantics.${name}.${branch}`)}>
                  Add a {branch} branch
                </Button>
              )}
            </>
          ) : isByAxis(current) ? (
            <p className={styles.paramNote}>This branch varies by {current.by}; edit it in the definition file.</p>
          ) : (
            <RuleFields rule={current} ramps={ramps} semantics={others} onChange={write} />
          )}
        </PropertyGroup>
      </PropertyPanel>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Mode</th>
              <th scope="col">Rule produced</th>
              <th scope="col">Pin</th>
              <th scope="col">Contrast</th>
            </tr>
          </thead>
          <tbody>
            {row.cells.map((c) => (
              <tr key={c.mode ?? 'value'}>
                <th scope="row">{c.mode ?? 'value'}</th>
                <td>
                  <code>{c.produced}</code>
                </td>
                <td>{c.pin !== undefined ? <code>{c.pin}</code> : '—'}</td>
                <td className={styles.num}>
                  {c.checks.length === 0
                    ? '—'
                    : c.checks.map((k) => `${k.against} ${k.ratio === null ? 'n/a' : k.ratio.toFixed(2)} of ${k.min}`).join('; ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
