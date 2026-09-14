import { isByAxis, type Varying } from '@weasel-js/theme';
import type { SemanticRule } from '@weasel-js/theme/engine';
import { Button, CheckboxRow, NumberRow, PropertyGroup, PropertyPanel, SelectRow, TextRow, ToggleRow } from '@weasel-js/ui';
import { useState } from 'react';
import styles from '../ThemeEditor.module.css';
import { RULE_KINDS, defaultRule, ruleKind, type SemanticRowView } from '../theme/semantics';

type Ramps = Readonly<Record<string, readonly string[]>>;

export interface SemanticDrawerProps {
  readonly name: string;
  readonly rule: Varying<SemanticRule>;
  readonly row: SemanticRowView;
  readonly modes: readonly (string | undefined)[];
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
        <TextRow
          label="Against"
          value={rule.contrast.against.join(', ')}
          onChange={(v) =>
            onChange(
              {
                ...rule,
                contrast: {
                  ...rule.contrast,
                  against: v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              },
              'contrast.against',
            )
          }
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

export function SemanticDrawer({ name, rule, row, modes, ramps, semantics, issues, onRule, onRevert, onClose }: SemanticDrawerProps) {
  const modeValues = modes.filter((m): m is string => m !== undefined);
  const varies = isByAxis(rule) && rule.by === 'mode';
  const [branch, setBranch] = useState(modeValues[0] ?? '');
  const current = (varies ? (rule as unknown as Record<string, unknown>)[branch] : rule) as SemanticRule | undefined;

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
      {current ? (
        <PropertyPanel title="Rule">
          <PropertyGroup title="Kind">
            {modeValues.length > 1 && <CheckboxRow label="Varies by mode" value={varies} onChange={setVaries} />}
            {varies && <ToggleRow label="Editing" value={branch} options={modeValues.map((m) => ({ value: m, label: m }))} onChange={setBranch} />}
            <SelectRow label="Rule" value={ruleKind(current)} options={RULE_KINDS} onChange={(kind) => write(defaultRule(kind, current, ramps, semantics), 'kind')} />
          </PropertyGroup>
          <PropertyGroup title="Fields">
            <RuleFields rule={current} ramps={ramps} semantics={semantics} onChange={write} />
          </PropertyGroup>
        </PropertyPanel>
      ) : (
        <p className={styles.paramNote}>This rule has no {branch} branch.</p>
      )}
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
