import { type CSSProperties, useMemo } from 'react';
import { useNativeHold } from '../Disabled/nativeHold';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { toHex } from './color';
import s from './TokenPanel.module.css';
import { bezierPoints, NUMBER_FORMAT, shownAlike, splitUnit, type TokenEntry } from './tokenTypes';

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

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

/** The control a token's type edits it with. */
export function TokenControl({ token, set }: { token: TokenEntry; set: (value: string) => void }) {
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
              if (Number.isFinite(amount) && !shownAlike(amount, split.amount)) set(`${amount}${split.unit}`);
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
            <ColorInput name={name} hex={hex} set={set} />
          ) : (
            <span className={s.chip} style={{ '--token-color': value } as CSSProperties} aria-hidden="true" />
          )
        }
      />
    </>
  );
}

/** The swatch beside a color's text, a native picker held as the panel is. */
function ColorInput({ name, hex, set }: { name: string; hex: string; set: (value: string) => void }) {
  const hold = useNativeHold({}, { readonlyRole: false });
  return hold.wrap(
    <input
      type="color"
      className={s.swatchInput}
      aria-label={`${name} color`}
      value={hex}
      {...hold.attrs}
      // Held, the picker does not open: it could pick nothing.
      onClick={(event) => { if (hold.refuses) event.preventDefault(); }}
      onChange={(event) => { if (!hold.refuses) set(event.target.value); }}
    />,
  );
}
