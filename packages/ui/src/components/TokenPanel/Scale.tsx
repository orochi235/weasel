import { useEffect, useMemo, useRef, useState } from 'react';
import { decimalPlaces } from '@weasel-js/quantity';
import { maxOf, minOf } from '@weasel-js/geom';
import { NumberField } from '../NumberField';
import { Slider, type Thumb } from '../Slider';
import { SegmentedBar, type SegmentedBarItem } from '../Segmented';
import { Reset, shortName, stepLabels, tipOf } from './parts';
import own from './Scale.module.css';
import s from './TokenPanel.module.css';
import {
  NUMBER_FORMAT,
  type OnTokenChange,
  refitScale,
  roundFit,
  shownAlike,
  splitUnit,
  type TokenEntry,
  type TokenScale,
  type TokenScaleRule,
} from './tokenTypes';

const RULES: readonly SegmentedBarItem<TokenScaleRule['kind']>[] = [
  { value: 'factors', label: 'each', ariaLabel: 'factors' },
  { value: 'ratio', label: 'ratio' },
  { value: 'step', label: 'step' },
];

function ScaleRuleControls({
  group,
  scale,
  amounts,
  onScaleChange,
}: {
  group: string;
  scale: TokenScale;
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
            if (Number.isFinite(base) && !shownAlike(base, scale.base)) onScaleChange({ ...scale, base });
          }}
        />
      </span>
      <SegmentedBar
        aria-label={`${group} rule`}
        size="sm"
        items={RULES}
        value={rule.kind}
        onChange={(kind) => {
          if (kind && kind !== rule.kind) onScaleChange(refitScale(scale, kind, amounts));
        }}
      />
      {param ? (
        <span className={s.stepEdit}>
          {param.key === 'ratio' ? <span className={s.op}>×</span> : <span className={s.op}>+</span>}
          <NumberField
            className={s.number}
            aria-label={`${group} ${param.key}`}
            value={param.value}
            hideSteppers
            formatOptions={NUMBER_FORMAT}
            onChange={(value) => {
              if (Number.isFinite(value) && !shownAlike(value, param.value)) onScaleChange({ ...scale, rule: { kind: param.key, [param.key]: value } as TokenScaleRule });
            }}
          />
        </span>
      ) : null}
    </div>
  );
}

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
  // Fine enough to move the smallest step by a third of itself or less, however round the amounts are now.
  const places = Math.min(4, Math.max(0, maxOf(amounts, decimalPlaces), Math.ceil(Math.log10(3 / minOf(amounts)))));
  const round = (n: number) => Number(n.toFixed(places));
  // A key press moves a step by this much: a log track's own step is smaller than the scale can write.
  const finest = 10 ** -places;
  const fit = [Math.log2(minOf(amounts) / MARGIN), Math.log2(maxOf(amounts) * MARGIN)] as const;
  // Held from a press to its release: a range that followed the thumbs would move the track under the pointer.
  const [held, setHeld] = useState<readonly [number, number] | null>(null);
  const [min, max] = held ? [Math.min(held[0], fit[0]), Math.max(held[1], fit[1])] : fit;
  useEffect(() => {
    if (!held) return;
    const release = () => setHeld(null);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [held]);

  const factors = generator?.rule.kind === 'factors' && onScaleChange ? generator.rule.factors : null;
  const thumbs: StepThumb[] = tokens.map((t, i) => ({
    token: t.name,
    value: Math.log2(amounts[i]!),
    label: t.name,
    shape: BARE,
    valueText: `${amounts[i]}${unit}`,
  }));

  // What the gesture began from, so Escape can put back each step it wrote and the rule it refit.
  const pressed = useRef<{ tokens: readonly TokenEntry[]; generator?: TokenScale; touched: Set<string>; refit: boolean } | null>(null);
  const commit = (next: StepThumb[]) => {
    const was = (pressed.current ??= { tokens, generator, touched: new Set(), refit: false });
    let fitted = factors;
    next.forEach((thumb, i) => {
      // An untouched thumb comes back too, and its amount may not survive `round`.
      if (thumb.value === thumbs[i]?.value) return;
      const amount = round(2 ** thumb.value);
      if (amount === amounts[i] || amount <= 0) return;
      const at = generator ? generator.tokens.indexOf(thumb.token) : -1;
      const factor = generator && generator.base > 0 ? roundFit(amount / generator.base) : 0;
      // A factor reaches the dragged amount only from a positive base, only for a step it has an entry for, and only
      // when it does not round away to nothing.
      if (fitted && factor > 0 && at >= 0 && at < fitted.length) {
        fitted = fitted.map((f, j) => (j === at ? factor : f));
      } else {
        was.touched.add(thumb.token);
        onChange(thumb.token, `${amount}${unit}`);
      }
    });
    if (fitted !== factors && fitted && generator) {
      was.refit = true;
      onScaleChange?.(group, { ...generator, rule: { kind: 'factors', factors: fitted } });
    }
  };
  const cancel = () => {
    const was = pressed.current;
    pressed.current = null;
    if (!was) return;
    for (const t of was.tokens) if (was.touched.has(t.name)) onChange(t.name, t.overridden ? t.value : null);
    if (was.refit && was.generator) onScaleChange?.(group, was.generator);
  };

  return (
    // A drag that ends where it began commits nothing, so a press, not a commit, is what starts a gesture afresh.
    <div className={own.gesture} onPointerDownCapture={() => {
        pressed.current = null;
        setHeld([min, max]);
      }}>
      <Slider<StepThumb>
        className={own.slider}
        thumbs={thumbs}
        min={min}
        max={max}
        step={0.001}
        keyStep={(thumb, steps) => Math.log2(Math.max(finest, round(2 ** thumb.value + steps * finest)))}
        thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"
        readoutPlacement="below-thumb"
        renderReadout={(_, i) => (
          <span className={own.readout} data-overridden={tokens[i]?.overridden ? '' : undefined}>
            <span className={own.label}>{labels[i]}</span>
            <span className={own.amount}>{amounts[i]}</span>
          </span>
        )}
        onInput={commit}
        onChange={() => (pressed.current = null)}
        onCancel={cancel}
      />
    </div>
  );
}

/** A group of sizes: its name on the rail, a slider with a thumb per step under it, and its base and rule beside
 *  the name when it is generated. */
export function Scale({
  group,
  tokens,
  generator,
  prefix,
  onChange,
  onScaleChange,
}: {
  group: string;
  tokens: readonly TokenEntry[];
  generator?: TokenScale;
  prefix: string;
  onChange: OnTokenChange;
  onScaleChange?: (group: string, scale: TokenScale) => void;
}) {
  const labels = useMemo(() => stepLabels(tokens.map((t) => t.name)), [tokens]);
  const units = new Set(tokens.map((t) => splitUnit(t.value)?.unit ?? ''));
  const unit = units.size === 1 ? [...units][0]! : null;
  const overridden = tokens.filter((t) => t.overridden);
  return (
    <div className={s.scale} role="group" aria-label={group}>
      <span className={s.name} title={group}>
        {shortName(group, prefix)}
        {unit ? <span className={s.unit}> {unit}</span> : null}
      </span>
      {overridden.length > 0 ? (
        <Reset
          name={group}
          onPress={() => {
            for (const t of overridden) onChange(t.name, null);
          }}
        />
      ) : null}
      <div className={s.scaleBody}>
        {generator && onScaleChange ? (
          <ScaleRuleControls
            group={group}
            scale={generator}
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
    <div className={s.step} title={tipOf(token)} data-overridden={token.overridden ? '' : undefined}>
      <span className={s.stepLabel}>{label}</span>
      <span className={s.stepEdit}>
        <NumberField
          className={s.number}
          aria-label={`${token.name} value`}
          value={split.amount}
          hideSteppers
          formatOptions={NUMBER_FORMAT}
          onChange={(amount) => {
            if (Number.isFinite(amount) && !shownAlike(amount, split.amount)) onChange(token.name, `${amount}${split.unit}`);
          }}
        />
        {showUnit && split.unit ? <span className={s.unit}>{split.unit}</span> : null}
      </span>
    </div>
  );
}
