import { type CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import { Button } from '../Button';
import { DisclosureRow } from '../Disclosure';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { toHex } from './color';
import s from './TokenPanel.module.css';
import {
  bezierPoints,
  splitUnit,
  TOKEN_CATEGORIES,
  type TokenCategory,
  type TokenEntry,
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
  /** Files a token under a section. Defaults to `tokenCategory`. */
  categorize?: (token: TokenEntry) => TokenCategory;
  /** The fewest colors sharing a group that draw as one row of swatches. Default 3. */
  familySize?: number;
  className?: string;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const NUMBER_FORMAT = { maximumFractionDigits: 4, useGrouping: false } as const;

type Item = { kind: 'row'; token: TokenEntry } | { kind: 'family'; group: string; tokens: TokenEntry[] };

function itemsOf(tokens: readonly TokenEntry[], familySize: number): Item[] {
  const colors = new Map<string, number>();
  for (const token of tokens) if (token.type === 'color') colors.set(token.group, (colors.get(token.group) ?? 0) + 1);
  const families = new Map<string, Extract<Item, { kind: 'family' }>>();
  const items: Item[] = [];
  for (const token of tokens) {
    if (token.type !== 'color' || (colors.get(token.group) ?? 0) < familySize) {
      items.push({ kind: 'row', token });
      continue;
    }
    let family = families.get(token.group);
    if (!family) {
      family = { kind: 'family', group: token.group, tokens: [] };
      families.set(token.group, family);
      items.push(family);
    }
    family.tokens.push(token);
  }
  return items;
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
          <button
            key={t.name}
            type="button"
            className={s.swatch}
            style={{ '--token-color': t.value } as CSSProperties}
            aria-label={t.name}
            aria-pressed={t.name === picked}
            title={`${t.name}: ${t.value}`}
            data-overridden={t.overridden ? '' : undefined}
            onClick={() => setPicked((current) => (current === t.name ? null : t.name))}
          />
        ))}
      </div>
      {token ? <TokenRow token={token} onChange={onChange} /> : null}
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  tokens,
  familySize,
  onChange,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  tokens: readonly TokenEntry[];
  familySize: number;
  onChange: OnChange;
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
 * color group drawn as one row of swatches sized to fit, and a control for each
 * type — a number with its unit for dimensions and durations, the nine weights
 * for a font weight, a curve beside a `cubic-bezier()`, a swatch beside a color,
 * and text for everything else.
 */
export function TokenPanel({
  tokens,
  onChange,
  collapsed,
  onCollapsedChange,
  categorize = tokenCategory,
  familySize = 3,
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
    <div className={className ? `${s.panel} ${className}` : s.panel}>
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
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}
