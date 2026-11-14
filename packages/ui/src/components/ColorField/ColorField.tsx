import { useState } from 'react';
import { getAlpha01, withAlpha01 } from '@weasel-js/core';
import { normalizeHex, parseColor, rgbaToHex } from '@weasel-js/paint';
import { OpacityRange } from '../OpacityRange/OpacityRange';
import { ColorChip, useRecordApplied, type AppliedColor } from './ColorChip';
import s from './ColorField.module.css';
import { holdScope, type HoldProps } from '../Disabled';
import { useNativeHold } from '../Disabled/nativeHold';

/**
 * Props for {@link ColorField}. `onInput` fires throughout a gesture and
 * `onChange` once at its end.
 */
export interface ColorFieldProps extends HoldProps {
  /** Current color, `#rrggbb` or `#rrggbbaa`. Omit when `mixed` or `unset`. */
  value?: string;
  /** Indeterminate presentation (multi-selection with differing colors):
   *  checkered chip, empty value. The first color edit produces a real
   *  value; the opacity slider stays disabled until then (an alpha-only
   *  edit would otherwise commit a value composed against the
   *  placeholder black). */
  mixed?: boolean;
  /** No color is held, and whatever paints comes from a fallback: drawn as `mixed` is, without saying the
   *  values disagree, so an opacity edit cannot write the placeholder back as a color. */
  unset?: boolean;
  /** Show the opacity slider; emitted values are `#rrggbbaa`. */
  alpha?: boolean;
  /** Draw the opacity slider inert, for a consumer that drops alpha. */
  alphaDisabled?: boolean;
  /** Live value during interaction (picker drag, slider drag). Optional —
   *  wire it for live preview; omit it for commit-only consumers. */
  onInput?: (hex: string) => void;
  /** Committed value — picker close or blur, or slider release. One call
   *  per user gesture; pair with an undoable write. Return the color actually
   *  applied when it differs, and the recent colors record that instead. */
  onChange: (hex: string) => AppliedColor;
  /** Id for the color input, for a `<label htmlFor>` outside it. */
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * `value` as `#rrggbbaa`, which is all the native picker shows. A color written any other way CSS has (`rgba()`,
 * `hsl()`, a name) is read as the color it names; one that cannot be read here (`rgb(from …)`, `oklch()`) is black.
 */
function hex8Of(value: string): string {
  try {
    return normalizeHex(rgbaToHex(parseColor(value)), 'rgba');
  } catch {
    return '#000000ff';
  }
}

/**
 * Compact color editor: native color input + optional opacity slider.
 * Commit semantics are gesture-based (see `onChange`) because native
 * color/range inputs fire `change` continuously during interaction —
 * commit-on-change would emit one undo entry per tick.
 */
export function ColorField(props: ColorFieldProps) {
  const { value, mixed = false, unset = false, alpha = false, alphaDisabled = false, onInput, onChange, id, className } = props;
  const hex8 = hex8Of(value ?? '#000000');
  const rgb6 = hex8.slice(0, 7);
  const alpha01 = getAlpha01(hex8);

  // The chip holds the color through a pick; this is the pick it last reported, until it commits, so the
  // opacity slider composes against it and an indeterminate chip stops looking indeterminate once edited.
  const [picked, setPicked] = useState<string | null>(null);
  const [alphaDraft, setAlphaDraft] = useState<number | null>(null);
  const visibleRgb = picked ?? rgb6;
  // The slider moves in whole percents; an alpha it has not moved keeps its exact byte.
  const visibleAlpha = alphaDraft ?? alpha01;

  const compose = (rgb: string, a01: number): string =>
    alpha ? withAlpha01(rgb, a01) : rgb;

  // Mixed with no color edit yet: the alpha slider has nothing real to
  // compose against (rgb6 is the placeholder black), so keep it disabled
  // until the first color edit lands.
  const alphaLocked = (mixed || unset) && picked === null;

  const recordApplied = useRecordApplied();
  const apply = (next: string) => onChange(next) ?? next;

  const hold = useNativeHold(props, { readonlyRole: false });

  return (
    <span
      className={[s.root, className].filter(Boolean).join(' ')}
      {...(mixed && picked === null ? { 'data-mixed': '' } : {})}
      {...(unset && !mixed && picked === null ? { 'data-unset': '' } : {})}
    >
      {hold.wrap(<span className={s.chip}>
        <ColorChip
          id={id}
          className={s.color}
          value={rgb6}
          refuses={hold.refuses}
          {...hold.attrs}
          aria-label={props['aria-label'] ?? 'Color'}
          onInput={(rgb) => {
            setPicked(rgb);
            onInput?.(compose(rgb, visibleAlpha));
          }}
          onChange={(rgb) => {
            setPicked(null);
            setAlphaDraft(null);
            return apply(compose(rgb, visibleAlpha));
          }}
        />
      </span>)}
      {alpha && holdScope(props, (
        <OpacityRange
          value={visibleAlpha}
          disabled={alphaLocked || alphaDisabled}
          aria-label={props['aria-label']}
          onInput={(a01) => {
            setAlphaDraft(a01);
            onInput?.(compose(visibleRgb, a01));
          }}
          onChange={(a01) => {
            // Only a slider that moved commits: a release with no drag would add a no-op undo entry.
            if (alphaDraft === null) return;
            setAlphaDraft(null);
            setPicked(null);
            const next = compose(visibleRgb, a01);
            recordApplied(apply(next), next);
          }}
        />
      ))}
    </span>
  );
}
