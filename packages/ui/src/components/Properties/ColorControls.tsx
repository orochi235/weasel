import { useRef } from 'react';
import { hexAlpha, toHex8, withAlpha01 } from '@weasel-js/paint';
import { ColorField } from '../ColorField';
import { PaintField } from '../PaintField';
import { PaintInput } from '../PaintInput';
import type { PropertyColorFieldProps, PropertyPaintFieldProps } from './fieldTypes';
import s from './Properties.module.css';
import { useFieldControl } from '../Field/fieldSemantics';
import { useNameText } from './nameOf';
import { useHoldReason } from '../Disabled/HoldReason';

/** A hex color as the `#rrggbb` it paints and the 0..1 alpha beside it.
 *  Anything unreadable is opaque black, which is what a swatch would show for
 *  it anyway. */
function splitAlpha(value: string | undefined): { rgb: string; alpha: number } {
  const eight = toHex8(value?.trim() ?? '');
  if (!/^#[0-9a-f]{8}$/i.test(eight)) return { rgb: '#000000', alpha: 1 };
  return { rgb: eight.slice(0, 7).toLowerCase(), alpha: hexAlpha(eight) };
}

export function ColorControl(p: PropertyColorFieldProps) {
  const text = useNameText(p.name);
  // The chip, which the row's label points at; its name is text, which the opacity slider beside it builds on.
  const { id } = useFieldControl({ id: p.id });
  const withAlpha = p.alpha !== undefined && p.alpha !== false;
  const apart = typeof p.alpha === 'number';
  const split = splitAlpha(p.value);
  const alpha = apart ? (p.alpha as number) : split.alpha;

  // `ColorField` holds alpha in the hex. One kept in a channel of its own goes
  // in with the color and comes back out of it, each half to its own callback.
  // Which half the gesture in progress has moved. A caller following the live
  // callbacks has already moved `value` by the time the gesture settles, so
  // comparing against it then would find nothing to commit.
  const moved = useRef({ rgb: false, alpha: false });
  const route =
    (write: (hex: string) => void, own: ((a: number) => void) | undefined, settles: boolean) => (hex: string) => {
      if (!apart) {
        write(hex);
        return;
      }
      const next = splitAlpha(hex);
      // Read back at the track's percent, which is all a hex byte can hold of it.
      const a = Math.round(next.alpha * 100) / 100;
      // A `#rrggbb` from the field leaves the opacity alone: it is a pick on a mixed or unset color.
      const kept = /^#[0-9a-f]{6}$/i.test(hex);
      const differs = { rgb: next.rgb !== split.rgb, alpha: !kept && a !== Math.round(alpha * 100) / 100 };
      const gesture = { rgb: moved.current.rgb || differs.rgb, alpha: moved.current.alpha || differs.alpha };
      moved.current = settles ? { rgb: false, alpha: false } : gesture;
      const half = settles ? gesture : differs;
      if (half.rgb || !own) write(next.rgb);
      if (half.alpha) own?.(a);
    };
  const live = route((hex) => p.onInput?.(hex), p.onAlphaInput, false);
  const settled = route(p.onChange, p.onAlphaChange, true);
  return (
    <ColorField
      id={id}
      className={p.className ? `${s.colorField} ${p.className}` : s.colorField}
      value={p.mixed || p.unset ? undefined : withAlpha ? withAlpha01(split.rgb, alpha) : (p.value ?? '#000000')}
      mixed={p.mixed}
      unset={p.unset}
      alpha={withAlpha}
      alphaDisabled={p.alphaDisabled}
      disabled={p.disabled}
      disabledReason={p.disabledReason}
      onInput={live}
      onChange={settled}
      onCancel={() => {
        moved.current = { rgb: false, alpha: false };
        p.onCancel?.();
      }}
      aria-label={text}
    />
  );
}

export function PaintControl(p: PropertyPaintFieldProps) {
  const text = useNameText(p.name);
  const why = useHoldReason(p.disabled ? p.disabledReason : undefined);
  if (p.control !== 'inline') {
    return p.disabled
      ? <PaintField className={p.className} value={p.value} mixed={p.mixed} unset={p.unset} inherit={p.inherit} disabled disabledReason={p.disabledReason} onChange={p.onChange} aria-label={text} />
      : <PaintField className={p.className} value={p.value} mixed={p.mixed} unset={p.unset} kinds={p.kinds} allowNone={p.allowNone} inherit={p.inherit} onChange={p.onChange} onInput={p.onInput} onCancel={p.onCancel} aria-label={text} />;
  }
  const disabled = p.disabled === true;
  // The inline editor is a stack of controls, and a kind's editor may be a consumer's: drawn inert, it keeps
  // the height it has enabled, so the rows under it do not move when a condition flips. Enabled or not, the tree
  // is the same, so a flip does not remount the editor and lose its state.
  return why.wrap(
    <div
      className={disabled ? (p.className ? `${s.paintDisabled} ${p.className}` : s.paintDisabled) : s.paintEnabled}
      role={disabled ? 'group' : undefined}
      aria-label={disabled ? text : undefined}
      aria-disabled={disabled || undefined}
      aria-describedby={why.describedBy}
    >
      {/* Set on the node: React 18 does not know the attribute. */}
      <div ref={(el) => { el?.toggleAttribute('inert', disabled); }} className={s.paintDisabledBody}>
        <PaintInput
          className={disabled ? undefined : p.className}
          value={p.value}
          mixed={p.mixed}
          unset={p.unset}
          kinds={p.kinds}
          allowNone={p.allowNone}
          inherit={p.inherit}
          onChange={p.onChange}
          onInput={p.onInput}
          onCancel={p.onCancel}
          aria-label={text}
        />
      </div>
    </div>,
  );
}
