import { type CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import { Focusable } from 'react-aria-components';
import { DisclosureRow } from '../Disclosure';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { toHex } from './color';
import { Reset, shortName, stepLabels, tipOf } from './parts';
import { Scale } from './Scale';
import s from './TokenPanel.module.css';
import {
  bezierPoints,
  NUMBER_FORMAT,
  type OnTokenChange as OnChange,
  splitUnit,
  TOKEN_CATEGORIES,
  type TokenCategory,
  type TokenEntry,
  type TokenScale,
  tokenCategory,
} from './tokenTypes';


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
  /** The fewest colors, or sizes, sharing a group that draw as one row of swatches or one slider of steps. Default 3. */
  familySize?: number;
  /** Left off every name the panel draws, so `--wzl-` does not repeat down the rail. The full name is in each tooltip. */
  namePrefix?: string;
  className?: string;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

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

type RunLabel = { group: string; step: string; first: boolean };

/** Rows standing together that share a group, each named by what it adds to the group's name, so the name is read
 *  once down the rail. A row whose name does not start with its group stands alone. */
function rowRuns(items: readonly Item[], prefix: string): Map<string, RunLabel> {
  const out = new Map<string, RunLabel>();
  let run: TokenEntry[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const group = shortName(run[0]?.group ?? '', prefix.replace(/^--/, ''));
      run.forEach((token, i) => {
        const short = shortName(token.name, prefix);
        out.set(token.name, { group, step: short === group ? '' : short.slice(group.length + 1), first: i === 0 });
      });
    }
    run = [];
  };
  for (const item of items) {
    const token = item.kind === 'row' ? item.token : null;
    const group = token && shortName(token.group, prefix.replace(/^--/, ''));
    const short = token && shortName(token.name, prefix);
    const fits = token && group && short && (short === group || short.startsWith(`${group}-`));
    if (!fits || (run[0] && run[0].group !== token.group)) flush();
    if (fits) run.push(token);
  }
  flush();
  return out;
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
        placeholder="unset"
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
  function TokenRow({
    token,
    label,
    lead,
    leadHidden,
    onChange,
  }: {
    token: TokenEntry;
    label: string;
    /** The group a run of rows shares, drawn before the label; hidden but kept on every row after the first. */
    lead?: string;
    leadHidden?: boolean;
    onChange: OnChange;
  }) {
    const set = useCallback((value: string) => onChange(token.name, value), [onChange, token.name]);
    return (
      <div
        className={s.row}
        role="group"
        aria-label={token.name}
        data-overridden={token.overridden ? '' : undefined}
        data-unset={token.value === '' ? '' : undefined}
      >
        <span className={s.name} title={tipOf(token)}>
          {lead ? (
            <span className={s.lead} aria-hidden={leadHidden || undefined} data-hidden={leadHidden ? '' : undefined}>
              {lead}
            </span>
          ) : null}
          {label}
        </span>
        <div className={s.edit}>
          <TokenControl token={token} set={set} />
        </div>
        {token.overridden ? <Reset label={`Reset ${token.name}`} onPress={() => onChange(token.name, null)} /> : null}
      </div>
    );
  },
  // Consumers rebuild their entries each render; a row only has to redraw when what it shows changed.
  (a, b) =>
    a.onChange === b.onChange &&
    a.label === b.label &&
    a.lead === b.lead &&
    a.leadHidden === b.leadHidden &&
    a.token.name === b.token.name &&
    a.token.type === b.token.type &&
    a.token.value === b.token.value &&
    a.token.overridden === b.token.overridden &&
    a.token.description === b.token.description,
);

function Family({
  group,
  tokens,
  prefix,
  onChange,
}: {
  group: string;
  tokens: readonly TokenEntry[];
  prefix: string;
  onChange: OnChange;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const labels = useMemo(() => stepLabels(tokens.map((t) => t.name)), [tokens]);
  const at = tokens.findIndex((t) => t.name === picked);
  const token = tokens[at] ?? null;
  const overridden = tokens.filter((t) => t.overridden);
  return (
    <div className={s.family} role="group" aria-label={group}>
      <span className={s.name} title={group}>
        {shortName(group, prefix.replace(/^--/, ''))}
      </span>
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
            <Tooltip>
              <span className={s.tip}>
                <span>{t.name}</span>
                <code>{t.value}</code>
              </span>
            </Tooltip>
          </TooltipTrigger>
        ))}
      </div>
      {overridden.length > 0 ? (
        <Reset
          label={`Reset ${group}`}
          onPress={() => {
            for (const t of overridden) onChange(t.name, null);
          }}
        />
      ) : null}
      {token ? <TokenRow token={token} label={`${group} ${labels[at] ?? ''}`.trim()} onChange={onChange} /> : null}
    </div>
  );
}

function Section({
  id,
  title,
  open,
  onToggle,
  tokens,
  familySize,
  scales,
  prefix,
  onChange,
  onScaleChange,
}: {
  id: TokenCategory;
  title: string;
  prefix: string;
  open: boolean;
  onToggle: () => void;
  tokens: readonly TokenEntry[];
  familySize: number;
  scales?: Readonly<Record<string, TokenScale>>;
  onChange: OnChange;
  onScaleChange?: (group: string, scale: TokenScale) => void;
}) {
  const items = useMemo(() => itemsOf(tokens, familySize), [tokens, familySize]);
  const runs = useMemo(() => rowRuns(items, prefix), [items, prefix]);
  return (
    <section className={s.section} aria-label={title} data-token-category={id}>
      <DisclosureRow className={s.sectionHead} open={open} onToggle={onToggle} label={title}>
        <span aria-hidden="true">{title}</span>
      </DisclosureRow>
      {open ? (
        <div className={s.sectionBody}>
          {items.map((item) =>
            item.kind === 'row' ? (
              <TokenRow
                key={item.token.name}
                token={item.token}
                label={runs.get(item.token.name)?.step ?? shortName(item.token.name, prefix)}
                lead={runs.get(item.token.name)?.group}
                leadHidden={runs.get(item.token.name)?.first === false}
                onChange={onChange}
              />
            ) : item.kind === 'scale' ? (
              <Scale
                key={`scale:${item.group}`}
                group={item.group}
                tokens={item.tokens}
                generator={scales?.[item.group]}
                prefix={prefix}
                onChange={onChange}
                onScaleChange={onScaleChange}
              />
            ) : (
              <Family
                key={`family:${item.group}`}
                group={item.group}
                tokens={item.tokens}
                prefix={prefix}
                onChange={onChange}
              />
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Edits a set of design tokens by type, a token to a line with the names on a
 * rail: collapsible sections by category, a
 * color group drawn as one row of swatches sized to fit, a group of sizes drawn
 * as one slider with a thumb per step — with its base and rule above it when
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
  namePrefix = '',
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
    <div className={[s.panel, className].filter(Boolean).join(' ')}>
      {TOKEN_CATEGORIES.map(({ id, title }) => {
        const inSection = byCategory.get(id);
        if (!inSection) return null;
        const open = !closed[id];
        return (
          <Section
            key={id}
            id={id}
            title={title}
            open={open}
            onToggle={() => {
              if (collapsed === undefined) setOwnCollapsed((prev) => ({ ...prev, [id]: open }));
              onCollapsedChange?.(id, open);
            }}
            tokens={inSection}
            familySize={familySize}
            scales={scales}
            prefix={namePrefix}
            onChange={onChange}
            onScaleChange={onScaleChange}
          />
        );
      })}
    </div>
  );
}
