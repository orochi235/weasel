import { type CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import { Focusable } from 'react-aria-components';
import { Button } from '../Button';
import { DisclosureRow } from '../Disclosure';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { toHex } from './color';
import s from './TokenPanel.module.css';
import {
  bezierPoints,
  refitScale,
  splitUnit,
  TOKEN_CATEGORIES,
  type TokenCategory,
  type TokenEntry,
  type TokenScale,
  type TokenScaleRule,
  tokenCategory,
} from './tokenTypes';

type OnChange = (name: string, value: string | null) => void;

/** Props for `<TokenPanel>`. */
export interface TokenPanelProps {
  tokens: readonly TokenEntry[];
  /** A token's new value, or null to drop its override. Keep it stable: rows re-render only when it or their token changes. */
  onChange: OnChange;
  /** Sections held closed, by category. Omit to let the panel keep that state itself. */
  collapsed?: Readonly<Partial<Record<TokenCategory, boolean>>>;
  onCollapsedChange?: (category: TokenCategory, collapsed: boolean) => void;
  /** Groups generated from a base, by group name. Such a group edits its base and rule above its steps. */
  scales?: Readonly<Record<string, TokenScale>>;
  /** A scale's new base or rule. The panel does not regenerate the steps; the consumer does, through `onChange`. */
  onScaleChange?: (group: string, scale: TokenScale) => void;
  /** Files a token under a section. Defaults to `tokenCategory`. */
  categorize?: (token: TokenEntry) => TokenCategory;
  /** The fewest colors, or sizes, sharing a group that draw as one row of swatches or one grid of steps. Default 3. */
  familySize?: number;
  /**
   * Row layout. `tight` puts a token on one line — name, control, Reset — with the
   * names on a fixed rail so the values read down the panel as a column, and caps
   * the field rather than letting it span the panel. Default `normal` stacks the
   * control under its name.
   */
  density?: 'tight' | 'normal';
  className?: string;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const NUMBER_FORMAT = { maximumFractionDigits: 4, useGrouping: false } as const;

type FamilyKind = 'family' | 'scale';
type Item = { kind: 'row'; token: TokenEntry } | { kind: FamilyKind; group: string; tokens: TokenEntry[] };

const SCALAR = new Set(['dimension', 'duration', 'number']);

function familyKindOf(token: TokenEntry): FamilyKind | null {
  if (token.type === 'color') return 'family';
  return SCALAR.has(token.type) && splitUnit(token.value) ? 'scale' : null;
}

function itemsOf(tokens: readonly TokenEntry[], familySize: number): Item[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    const kind = familyKindOf(token);
    if (kind) counts.set(`${kind}:${token.group}`, (counts.get(`${kind}:${token.group}`) ?? 0) + 1);
  }
  const families = new Map<string, Extract<Item, { kind: FamilyKind }>>();
  const items: Item[] = [];
  for (const token of tokens) {
    const kind = familyKindOf(token);
    const key = `${kind}:${token.group}`;
    if (!kind || (counts.get(key) ?? 0) < familySize) {
      items.push({ kind: 'row', token });
      continue;
    }
    let family = families.get(key);
    if (!family) {
      family = { kind, group: token.group, tokens: [] };
      families.set(key, family);
      items.push(family);
    }
    family.tokens.push(token);
  }
  return items;
}

/** Each name's segments past those every name in the set shares; a name that is all shared keeps its last. */
function stepLabels(names: readonly string[]): string[] {
  const split = names.map((name) => name.replace(/^--/, '').split('-'));
  let shared = 0;
  while (split.every((segments) => segments.length > shared && segments[shared] === split[0]?.[shared])) shared++;
  return split.map((segments) => segments.slice(shared).join('-') || (segments.at(-1) ?? ''));
}

function Curve({ points, label }: { points: readonly [number, number, number, number]; label: string }) {
  const [x1, y1, x2, y2] = points;
  // y is flipped so the curve rises, and the box grows to hold an overshoot.
  const top = Math.min(0, 1 - y1, 1 - y2);
  const bottom = Math.max(1, 1 - y1, 1 - y2);
  return (
    <svg className={s.curve} viewBox={`-0.1 ${top - 0.1} 1.2 ${bottom - top + 0.2}`} role="img" aria-label={label}>
      <path d={`M0 1 C${x1} ${1 - y1} ${x2} ${1 - y2} 1 0`} fill="none" stroke="currentColor" strokeWidth={0.08} />
    </svg>
  );
}

function TokenControl({ token, set }: { token: TokenEntry; set: (value: string) => void }) {
  const { name, type, value } = token;
  const label = `${name} value`;
  const hex = useMemo(() => (type === 'color' ? toHex(value) : null), [type, value]);

  if (type === 'dimension' || type === 'duration' || type === 'number') {
    const split = splitUnit(value);
    if (split) {
      return (
        <>
          <NumberField
            className={s.number}
            aria-label={label}
            value={split.amount}
            hideSteppers
            formatOptions={NUMBER_FORMAT}
            onChange={(amount) => {
              if (Number.isFinite(amount)) set(`${amount}${split.unit}`);
            }}
          />
          {split.unit ? <span className={s.unit}>{split.unit}</span> : null}
        </>
      );
    }
  }

  if (type === 'fontWeight') {
    const options = (WEIGHTS.includes(value) ? WEIGHTS : [...WEIGHTS, value]).map((weight) => ({
      value: weight,
      label: weight,
    }));
    return <Select aria-label={name} width="fit" selectedKey={value} options={options} onSelectionChange={set} />;
  }

  const points = type === 'cubicBezier' ? bezierPoints(value) : null;
  return (
    <>
      {points ? <Curve points={points} label={`${name} curve`} /> : null}
      <Input
        className={s.field}
        aria-label={label}
        value={value}
        onChange={set}
        leadingAdornment={
          type !== 'color' ? undefined : hex ? (
            <input
              type="color"
              className={s.swatchInput}
              aria-label={`${name} color`}
              value={hex}
              onChange={(event) => set(event.target.value)}
            />
          ) : (
            <span className={s.chip} style={{ '--token-color': value } as CSSProperties} aria-hidden="true" />
          )
        }
      />
    </>
  );
}

const TokenRow = memo(
  function TokenRow({ token, onChange }: { token: TokenEntry; onChange: OnChange }) {
    const set = useCallback((value: string) => onChange(token.name, value), [onChange, token.name]);
    return (
      <div className={s.row} role="group" aria-label={token.name}>
        <span className={s.name} title={token.description || token.name}>
          {token.name}
        </span>
        <div className={s.edit}>
          <TokenControl token={token} set={set} />
          {token.overridden ? (
            <Button variant="ghost" size="sm" ariaLabel={`Reset ${token.name}`} onClick={() => onChange(token.name, null)}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>
    );
  },
  // Consumers rebuild their entries each render; a row only has to redraw when what it shows changed.
  (a, b) =>
    a.onChange === b.onChange &&
    a.token.name === b.token.name &&
    a.token.type === b.token.type &&
    a.token.value === b.token.value &&
    a.token.overridden === b.token.overridden &&
    a.token.description === b.token.description,
);

function Family({ group, tokens, onChange }: { group: string; tokens: readonly TokenEntry[]; onChange: OnChange }) {
  const [picked, setPicked] = useState<string | null>(null);
  const token = tokens.find((t) => t.name === picked) ?? null;
  return (
    <div className={s.family} role="group" aria-label={group}>
      <span className={s.name}>{group}</span>
      <div className={s.strip}>
        {tokens.map((t) => (
          <TooltipTrigger key={t.name} delay={0}>
            <Focusable>
              <button
                type="button"
                className={s.swatch}
                style={{ '--token-color': t.value } as CSSProperties}
                aria-label={t.name}
                aria-pressed={t.name === picked}
                data-overridden={t.overridden ? '' : undefined}
                onClick={() => setPicked((current) => (current === t.name ? null : t.name))}
              />
            </Focusable>
            <Tooltip>{t.name}</Tooltip>
          </TooltipTrigger>
        ))}
      </div>
      {token ? <TokenRow token={token} onChange={onChange} /> : null}
    </div>
  );
}

function ScaleStep({
  token,
  label,
  showUnit,
  factor,
  onChange,
  onFactorChange,
}: {
  token: TokenEntry;
  label: string;
  showUnit: boolean;
  factor?: number;
  onChange: OnChange;
  onFactorChange?: (factor: number) => void;
}) {
  const split = splitUnit(token.value);
  if (!split) return null;
  return (
    <div className={s.step} title={token.description || token.name} data-overridden={token.overridden ? '' : undefined}>
      <span className={s.stepLabel}>{label}</span>
      <span className={s.stepEdit}>
        <NumberField
          className={s.number}
          aria-label={`${token.name} value`}
          value={split.amount}
          hideSteppers
          formatOptions={NUMBER_FORMAT}
          onChange={(amount) => {
            if (Number.isFinite(amount)) onChange(token.name, `${amount}${split.unit}`);
          }}
        />
        {showUnit && split.unit ? <span className={s.unit}>{split.unit}</span> : null}
      </span>
      {factor !== undefined && onFactorChange ? (
        <span className={s.stepEdit}>
          <span className={s.unit}>×</span>
          <NumberField
            className={s.number}
            aria-label={`${token.name} factor`}
            value={factor}
            hideSteppers
            formatOptions={NUMBER_FORMAT}
            onChange={(next) => {
              if (Number.isFinite(next)) onFactorChange(next);
            }}
          />
        </span>
      ) : null}
    </div>
  );
}

const RULES: readonly ToggleBarItem<TokenScaleRule['kind']>[] = [
  { value: 'factors', label: 'each', ariaLabel: 'factors' },
  { value: 'ratio', label: 'ratio' },
  { value: 'step', label: 'step' },
];

function ScaleRuleControls({
  group,
  scale,
  unit,
  amounts,
  onScaleChange,
}: {
  group: string;
  scale: TokenScale;
  unit: string;
  amounts: readonly number[];
  onScaleChange: (scale: TokenScale) => void;
}) {
  const { rule } = scale;
  const param =
    rule.kind === 'ratio'
      ? { key: 'ratio' as const, value: rule.ratio }
      : rule.kind === 'step'
        ? { key: 'step' as const, value: rule.step }
        : null;
  return (
    <div className={s.rule}>
      <span className={s.stepEdit}>
        <span className={s.ruleLabel}>base</span>
        <NumberField
          className={s.number}
          aria-label={`${group} base`}
          value={scale.base}
          hideSteppers
          formatOptions={NUMBER_FORMAT}
          onChange={(base) => {
            if (Number.isFinite(base)) onScaleChange({ ...scale, base });
          }}
        />
        {unit ? <span className={s.unit}>{unit}</span> : null}
      </span>
      <ToggleBar
        ariaLabel={`${group} rule`}
        size="sm"
        items={RULES}
        value={rule.kind}
        onChange={(kind) => {
          if (kind && kind !== rule.kind) onScaleChange(refitScale(scale, kind, amounts));
        }}
      />
      {param ? (
        <span className={s.stepEdit}>
          {param.key === 'ratio' ? <span className={s.unit}>×</span> : <span className={s.unit}>+</span>}
          <NumberField
            className={s.number}
            aria-label={`${group} ${param.key}`}
            value={param.value}
            hideSteppers
            formatOptions={NUMBER_FORMAT}
            onChange={(value) => {
              if (Number.isFinite(value)) onScaleChange({ ...scale, rule: { kind: param.key, [param.key]: value } as TokenScaleRule });
            }}
          />
        </span>
      ) : null}
    </div>
  );
}

function Scale({
  group,
  tokens,
  generator,
  onChange,
  onScaleChange,
}: {
  group: string;
  tokens: readonly TokenEntry[];
  generator?: TokenScale;
  onChange: OnChange;
  onScaleChange?: (group: string, scale: TokenScale) => void;
}) {
  const labels = useMemo(() => stepLabels(tokens.map((t) => t.name)), [tokens]);
  const units = new Set(tokens.map((t) => splitUnit(t.value)?.unit ?? ''));
  const unit = units.size === 1 ? [...units][0] : null;
  const overridden = tokens.filter((t) => t.overridden);
  return (
    <div className={s.scale} role="group" aria-label={group}>
      <span className={s.scaleHead}>
        <span className={s.name}>{group}</span>
        {unit ? <span className={s.unit}>{unit}</span> : null}
        {overridden.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            ariaLabel={`Reset ${group}`}
            onClick={() => {
              for (const t of overridden) onChange(t.name, null);
            }}
          >
            Reset
          </Button>
        ) : null}
      </span>
      {generator && onScaleChange ? (
        <ScaleRuleControls
          group={group}
          scale={generator}
          unit={unit ?? ''}
          amounts={generator.tokens.map(
            (name) => splitUnit(tokens.find((t) => t.name === name)?.value ?? '')?.amount ?? generator.base,
          )}
          onScaleChange={(next) => onScaleChange(group, next)}
        />
      ) : null}
      <div className={s.steps}>
        {tokens.map((t, i) => {
          const rule = generator?.rule;
          const at = generator ? generator.tokens.indexOf(t.name) : -1;
          const factor = rule?.kind === 'factors' && at >= 0 ? rule.factors[at] : undefined;
          return (
            <ScaleStep
              key={t.name}
              token={t}
              label={labels[i] ?? t.name}
              showUnit={unit === null}
              factor={factor}
              onChange={onChange}
              onFactorChange={
                generator && onScaleChange && rule?.kind === 'factors'
                  ? (next) =>
                      onScaleChange(group, {
                        ...generator,
                        rule: { kind: 'factors', factors: rule.factors.map((f, j) => (j === at ? next : f)) },
                      })
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  tokens,
  familySize,
  scales,
  onChange,
  onScaleChange,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  tokens: readonly TokenEntry[];
  familySize: number;
  scales?: Readonly<Record<string, TokenScale>>;
  onChange: OnChange;
  onScaleChange?: (group: string, scale: TokenScale) => void;
}) {
  const items = useMemo(() => itemsOf(tokens, familySize), [tokens, familySize]);
  return (
    <section className={s.section} aria-label={title}>
      <DisclosureRow className={s.sectionHead} open={open} onToggle={onToggle} label={title}>
        <span aria-hidden="true">{title}</span>
      </DisclosureRow>
      {open ? (
        <div className={s.sectionBody}>
          {items.map((item) =>
            item.kind === 'row' ? (
              <TokenRow key={item.token.name} token={item.token} onChange={onChange} />
            ) : item.kind === 'scale' ? (
              <Scale
                key={`scale:${item.group}`}
                group={item.group}
                tokens={item.tokens}
                generator={scales?.[item.group]}
                onChange={onChange}
                onScaleChange={onScaleChange}
              />
            ) : (
              <Family key={`family:${item.group}`} group={item.group} tokens={item.tokens} onChange={onChange} />
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Edits a set of design tokens by type: collapsible sections by category, a
 * color group drawn as one row of swatches sized to fit, a group of sizes drawn
 * as one grid of numbers labeled by step — with its base and rule above it when
 * `scales` says how it is generated — and a control for each
 * type — a number with its unit for dimensions and durations, the nine weights
 * for a font weight, a curve beside a `cubic-bezier()`, a swatch beside a color,
 * and text for everything else.
 */
export function TokenPanel({
  tokens,
  onChange,
  collapsed,
  onCollapsedChange,
  scales,
  onScaleChange,
  categorize = tokenCategory,
  familySize = 3,
  density = 'normal',
  className,
}: TokenPanelProps) {
  const [ownCollapsed, setOwnCollapsed] = useState<Partial<Record<TokenCategory, boolean>>>({});
  const closed = collapsed ?? ownCollapsed;
  const byCategory = useMemo(() => {
    const sections = new Map<TokenCategory, TokenEntry[]>();
    for (const token of tokens) {
      const category = categorize(token);
      sections.set(category, [...(sections.get(category) ?? []), token]);
    }
    return sections;
  }, [tokens, categorize]);

  return (
    <div className={[s.panel, density === 'tight' && s.tight, className].filter(Boolean).join(' ')}>
      {TOKEN_CATEGORIES.map(({ id, title }) => {
        const inSection = byCategory.get(id);
        if (!inSection) return null;
        const open = !closed[id];
        return (
          <Section
            key={id}
            title={title}
            open={open}
            onToggle={() => {
              if (collapsed === undefined) setOwnCollapsed((prev) => ({ ...prev, [id]: open }));
              onCollapsedChange?.(id, open);
            }}
            tokens={inSection}
            familySize={familySize}
            scales={scales}
            onChange={onChange}
            onScaleChange={onScaleChange}
          />
        );
      })}
    </div>
  );
}
