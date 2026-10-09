import { useMemo, useState } from 'react';
import { Button } from '../Button';
import { NumberField } from '../NumberField';
import { Slider, type Thumb } from '../Slider';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import s from './TokenPanel.module.css';
import {
  NUMBER_FORMAT,
  type OnTokenChange,
  refitScale,
  splitUnit,
  type TokenEntry,
  type TokenScale,
  type TokenScaleRule,
} from './tokenTypes';

/** Each name's segments past those every name in the set shares; a name that is all shared keeps its last. */
function stepLabels(names: readonly string[]): string[] {
  const split = names.map((name) => name.replace(/^--/, '').split('-'));
  let shared = 0;
  while (split.every((segments) => segments.length > shared && segments[shared] === split[0]?.[shared])) shared++;
  return split.map((segments) => segments.slice(shared).join('-') || (segments.at(-1) ?? ''));
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

/** Decimal places an amount is written with. */
const placesOf = (n: number) => (String(n).split('.')[1] ?? '').length;

/** Room past the outermost steps, as a factor, so an end thumb can still be dragged outward. */
const MARGIN = 1.5;

/** A plain thumb: the token's name labels it for a screen reader, and its readout shows the step. */
const BARE = { render: () => null };

interface StepThumb extends Thumb {
  token: string;
}

/**
 * A scale's steps as thumbs on one track. The track is logarithmic: a scale grows by ratios, so equal ratios
 * sit an equal distance apart and the small end does not crowd together.
 */
function ScaleSlider({
  group,
  tokens,
  labels,
  unit,
  generator,
  onChange,
  onScaleChange,
}: {
  group: string;
  tokens: readonly TokenEntry[];
  labels: readonly string[];
  unit: string;
  generator?: TokenScale;
  onChange: OnTokenChange;
  onScaleChange?: (group: string, scale: TokenScale) => void;
}) {
  const amounts = tokens.map((t) => splitUnit(t.value)?.amount ?? 0);
  const places = Math.min(4, Math.max(0, ...amounts.map(placesOf)));
  const round = (n: number) => Number(n.toFixed(places));
  // Held from the first render: a range that followed the thumbs would move the track under the pointer.
  const [range, setRange] = useState(() => [Math.log2(Math.min(...amounts) / MARGIN), Math.log2(Math.max(...amounts) * MARGIN)]);
  const [min, max] = [Math.min(range[0]!, ...amounts.map(Math.log2)), Math.max(range[1]!, ...amounts.map(Math.log2))];
  if (min !== range[0] || max !== range[1]) setRange([min, max]);

  const factors = generator?.rule.kind === 'factors' && onScaleChange ? generator.rule.factors : null;
  const thumbs: StepThumb[] = tokens.map((t, i) => ({
    token: t.name,
    value: Math.log2(amounts[i]!),
    label: t.name,
    shape: BARE,
    valueText: `${amounts[i]}${unit}`,
  }));

  const commit = (next: StepThumb[]) => {
    next.forEach((thumb, i) => {
      const was = amounts[i]!;
      const moved = Math.sign(thumb.value - Math.log2(was));
      if (moved === 0) return;
      // An arrow key moves a log track by less than the scale's precision; it still moves a step by one unit.
      const rounded = round(2 ** thumb.value);
      const amount = rounded === was ? round(was + moved * 10 ** -places) : rounded;
      if (amount <= 0) return;
      const at = generator ? generator.tokens.indexOf(thumb.token) : -1;
      if (factors && generator && at >= 0) {
        onScaleChange?.(group, {
          ...generator,
          rule: { kind: 'factors', factors: factors.map((f, j) => (j === at ? Number((amount / generator.base).toFixed(3)) || f : f)) },
        });
      } else {
        onChange(thumb.token, `${amount}${unit}`);
      }
    });
  };

  return (
    <Slider<StepThumb>
      className={s.scaleSlider}
      thumbs={thumbs}
      min={min}
      max={max}
      step={0.001}
      density="slim"
      readoutPlacement="below-thumb"
      renderReadout={(_, i) => (
        <span className={s.stepReadout} data-overridden={tokens[i]?.overridden ? '' : undefined}>
          <span className={s.stepLabel}>{labels[i]}</span>
          <span className={s.stepAmount}>{amounts[i]}</span>
        </span>
      )}
      onInput={commit}
    />
  );
}

/** A group of sizes: its name over a slider with a thumb per step, with its base and rule between when it is generated. */
export function Scale({
  group,
  tokens,
  generator,
  onChange,
  onScaleChange,
}: {
  group: string;
  tokens: readonly TokenEntry[];
  generator?: TokenScale;
  onChange: OnTokenChange;
  onScaleChange?: (group: string, scale: TokenScale) => void;
}) {
  const labels = useMemo(() => stepLabels(tokens.map((t) => t.name)), [tokens]);
  const units = new Set(tokens.map((t) => splitUnit(t.value)?.unit ?? ''));
  const unit = units.size === 1 ? [...units][0]! : null;
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
      {unit !== null && tokens.every((t) => (splitUnit(t.value)?.amount ?? 0) > 0) ? (
        <ScaleSlider
          group={group}
          tokens={tokens}
          labels={labels}
          unit={unit}
          generator={generator}
          onChange={onChange}
          onScaleChange={onScaleChange}
        />
      ) : (
        <div className={s.steps}>
          {tokens.map((t, i) => (
            <ScaleStep key={t.name} token={t} label={labels[i] ?? t.name} showUnit={unit === null} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One step as a number, for a scale the slider cannot draw: mixed units, or a step at zero. */
function ScaleStep({
  token,
  label,
  showUnit,
  onChange,
}: {
  token: TokenEntry;
  label: string;
  showUnit: boolean;
  onChange: OnTokenChange;
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
    </div>
  );
}
