import { useState } from 'react';
import { toHex8, getAlpha01, withAlpha01 } from '@weasel-js/core';
import s from './ColorField.module.css';

export interface ColorFieldProps {
  /** Current color, `#rrggbb` or `#rrggbbaa`. Omit when `mixed`. */
  value?: string;
  /** Indeterminate presentation (multi-selection with differing colors):
   *  checkered chip, empty value. The first edit produces a real value. */
  mixed?: boolean;
  /** Show the opacity slider; emitted values are `#rrggbbaa`. */
  alpha?: boolean;
  /** Live value during interaction (picker drag, slider drag). Optional —
   *  wire it for live preview; omit it for commit-only consumers. */
  onInput?: (hex: string) => void;
  /** Committed value — picker close (blur) or slider release. One call
   *  per user gesture; pair with an undoable write. */
  onChange: (hex: string) => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Compact color editor: native color input + optional opacity slider.
 * Commit semantics are gesture-based (see `onChange`) because native
 * color/range inputs fire `change` continuously during interaction —
 * commit-on-change would emit one undo entry per tick.
 */
export function ColorField(props: ColorFieldProps) {
  const { value, mixed = false, alpha = false, onInput, onChange, className } = props;
  const hex8 = toHex8(value ?? '#000000');
  const rgb6 = hex8.slice(0, 7);
  const alpha01 = getAlpha01(hex8);
  const alphaPct = Math.round(alpha01 * 100);

  // Drafts track the control during a gesture (the committed prop only
  // updates after onChange), then reset to follow the prop again.
  const [colorDraft, setColorDraft] = useState<string | null>(null);
  const [alphaDraft, setAlphaDraft] = useState<number | null>(null);
  const visibleRgb = colorDraft ?? rgb6;
  const visibleAlphaPct = alphaDraft ?? alphaPct;

  const compose = (rgb: string, a01: number): string =>
    alpha ? withAlpha01(rgb, a01) : rgb;

  // Commit only when a gesture actually changed something — blur with no
  // preceding input must not emit (it would create a no-op undo entry).
  const commit = (rgb: string, a01: number): void => {
    if (colorDraft === null && alphaDraft === null) return;
    onChange(compose(rgb, a01));
    setColorDraft(null);
    setAlphaDraft(null);
  };

  return (
    <span
      className={[s.root, className].filter(Boolean).join(' ')}
      {...(mixed && colorDraft === null ? { 'data-mixed': '' } : {})}
    >
      <span className={s.chip}>
        <input
          className={s.color}
          type="color"
          value={visibleRgb}
          aria-label={props['aria-label'] ?? 'Color'}
          onInput={(e) => {
            const rgb = (e.target as HTMLInputElement).value;
            setColorDraft(rgb);
            onInput?.(compose(rgb, visibleAlphaPct / 100));
          }}
          onBlur={() => commit(visibleRgb, visibleAlphaPct / 100)}
        />
      </span>
      {alpha && (
        <>
          <input
            className={s.alphaRange}
            type="range"
            min={0}
            max={100}
            step={1}
            value={visibleAlphaPct}
            aria-label="Opacity"
            onInput={(e) => {
              const pct = Number((e.target as HTMLInputElement).value);
              setAlphaDraft(pct);
              onInput?.(compose(visibleRgb, pct / 100));
            }}
            onPointerUp={() => commit(visibleRgb, visibleAlphaPct / 100)}
            onPointerCancel={() => commit(visibleRgb, visibleAlphaPct / 100)}
            onKeyUp={() => commit(visibleRgb, visibleAlphaPct / 100)}
          />
          <span className={s.alphaReadout}>{visibleAlphaPct}</span>
        </>
      )}
    </span>
  );
}
