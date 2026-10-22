import { useRef } from 'react';
import { getAlpha01, toHex8, withAlpha01 } from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { PaintField } from '../PaintField';
import { PaintInput } from '../PaintInput';
import { ignore } from './NumberControls';
import type { PropertyColorFieldProps, PropertyPaintFieldProps } from './fieldTypes';
import s from './Properties.module.css';

/** A hex color as the `#rrggbb` it paints and the 0..1 alpha beside it.
 *  Anything unreadable is opaque black, which is what a swatch would show for
 *  it anyway. */
function splitAlpha(value: string | undefined): { rgb: string; alpha: number } {
  const eight = toHex8(value?.trim() ?? '');
  if (!/^#[0-9a-f]{8}$/i.test(eight)) return { rgb: '#000000', alpha: 1 };
  return { rgb: eight.slice(0, 7).toLowerCase(), alpha: getAlpha01(eight) };
}

export function ColorControl(p: PropertyColorFieldProps) {
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
      const differs = { rgb: next.rgb !== split.rgb, alpha: a !== Math.round(alpha * 100) / 100 };
      const gesture = { rgb: moved.current.rgb || differs.rgb, alpha: moved.current.alpha || differs.alpha };
      moved.current = settles ? { rgb: false, alpha: false } : gesture;
      const half = settles ? gesture : differs;
      if (half.rgb || !own) write(next.rgb);
      if (half.alpha) own?.(a);
    };
  // As a number does: one callback is the live one, and the commit at the end
  // of a gesture would only repeat its last call.
  const drafting = p.onInput !== undefined || p.onAlphaInput !== undefined;
  const live = route(p.onInput ?? p.onChange, p.onAlphaInput ?? p.onAlphaChange, false);
  const settled = drafting ? route(p.onChange, p.onAlphaChange, true) : ignore;
  return (
    <ColorField
      id={p.id}
      className={p.className ? `${s.colorField} ${p.className}` : s.colorField}
      value={p.mixed ? undefined : withAlpha ? withAlpha01(split.rgb, alpha) : (p.value ?? '#000000')}
      mixed={p.mixed}
      alpha={withAlpha}
      alphaDisabled={p.alphaDisabled}
      disabled={p.disabled}
      onInput={live}
      onChange={settled}
      aria-label={p.name}
    />
  );
}

/** Takes a subtree out of focus order, hit testing, and the accessibility tree. Set on the node: React 18 does not know the attribute. */
const makeInert = (el: HTMLElement | null): void => {
  el?.toggleAttribute('inert', true);
};

export function PaintControl(p: PropertyPaintFieldProps) {
  if (p.disabled && p.control !== 'inline') {
    return <PaintField className={p.className} value={p.value} mixed={p.mixed} unset={p.unset} inherit={p.inherit} disabled onChange={p.onChange} aria-label={p.name} />;
  }
  const Editor = p.control === 'inline' ? PaintInput : PaintField;
  const editor = (
    <Editor
      className={p.disabled ? undefined : p.className}
      value={p.value}
      mixed={p.mixed}
      unset={p.unset}
      kinds={p.kinds}
      allowNone={p.allowNone}
      inherit={p.inherit}
      onChange={p.onChange}
      onInput={p.onInput}
      aria-label={p.name}
    />
  );
  if (!p.disabled) return editor;
  // The inline editor is a stack of controls, and a kind's editor may be a consumer's: drawn inert, it keeps
  // the height it has enabled, so the rows under it do not move when a condition flips.
  return (
    <div className={p.className ? `${s.paintOff} ${p.className}` : s.paintOff} role="group" aria-label={p.name} aria-disabled="true">
      <div ref={makeInert} className={s.paintOffBody}>
        {editor}
      </div>
    </div>
  );
}
