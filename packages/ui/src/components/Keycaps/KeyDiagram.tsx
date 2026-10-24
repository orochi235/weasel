import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { detectPlatform, keySpecFromCode, type KeyLabels, type LegendStyle, type Platform } from '@weasel-js/gestures';
import type { ColorSource } from '@weasel-js/paint';
import { useColorCss } from '@weasel-js/theme/react';
import { tintSource } from '../appearance';
import { KeyBank } from './KeyBank';
import { KeyCap } from './Keycap';
import { placeKeys, type KeyboardKey, type KeyboardLayout, type PlacedKey } from './keyboardLayout';
import s from './KeyDiagram.module.css';

/** What a {@link KeyDiagram} marks a key with, as the action it fires. */
export interface KeyMark {
  /** Printed under the key: what it does. */
  caption?: string;
  /** Drawn under the key in place of the caption. */
  icon?: ReactNode;
  /** The color the key is tinted with, so keys that share one read as one control wherever they sit:
   *  an index into the theme's tint list, or a color source. */
  tint?: number | ColorSource;
  /** Drawn faded, as a key that does nothing right now. */
  dimmed?: boolean;
}

/** Props for {@link KeyDiagram}. */
export interface KeyDiagramProps {
  /** Where the keys sit and how they group. Without one, the keys in `keys` are drawn in a row,
   *  ungrouped. */
  layout?: KeyboardLayout;
  /** The keys to draw. With a layout, only the layout's keys these name are drawn, in their places,
   *  and the diagram shrinks to fit them; without, each is drawn in turn. Defaults to every key the
   *  layout has. */
  keys?: readonly KeyboardKey[];
  /** Whose legends the keys print. Defaults to the layout's, then to the reader's. */
  platform?: Platform;
  /** Defaults to `'auto'`. */
  legend?: LegendStyle;
  /** Legends by `KeyboardEvent.code`, modifier name, or `KeyboardEvent.key`, replacing the tables'. */
  labels?: KeyLabels;
  /** Codes of the keys held down, which light up. `useHeldKeys` reads them off the keyboard. */
  held?: ReadonlySet<string>;
  /** Marks by code. */
  marks?: Readonly<Record<string, KeyMark>>;
  /** Hides the diagram until a key is held, and for this many seconds after the last is let go.
   *  Without it the diagram always shows. */
  linger?: number;
  /** Forwarded to every bank: lets a key print a two-line spelling, as Pg / Up. */
  wrap?: boolean;
  /** Font-family forwarded to every key. */
  font?: string;
  className?: string;
}

const NO_KEYS: ReadonlySet<string> = new Set();

/**
 * A keyboard, or the part of one a set of keys needs. Given a layout, it draws each key where the
 * keyboard puts it and groups them into `KeyBank`s the way the keyboard does, so a function row or a
 * navigation cluster prints its legends at one size. Keys held down light up; marked keys carry what
 * they do.
 */
export function KeyDiagram({
  layout, keys, platform, legend = 'auto', labels, held = NO_KEYS, marks, linger, wrap = true, font, className,
}: KeyDiagramProps) {
  const legendOpts = useMemo(
    () => ({ platform: platform ?? layout?.platform ?? detectPlatform(), legend, labels }),
    [platform, layout, legend, labels],
  );
  const placement = useMemo(() => {
    if (!layout) return null;
    return placeKeys(layout, keys ? new Set(keys.map((k) => (typeof k === 'string' ? k : k.code))) : undefined);
  }, [layout, keys]);
  const css = useColorCss();
  const up = useLinger(held.size > 0, linger);
  const captioned = marks !== undefined && Object.values(marks).some((m) => m.caption !== undefined || m.icon !== undefined);

  const slot = (key: Pick<PlacedKey, 'code' | 'label'>, place?: PlacedKey) => {
    const mark = marks?.[key.code];
    const tint = css(tintSource(mark?.tint));
    const vars = {
      ...(place && { '--x': place.x, '--y': place.y, '--w': place.width }),
      ...(tint && { '--tint': tint }),
    } as CSSProperties;
    const under = mark?.icon ?? mark?.caption;
    return (
      <span
        key={key.code}
        className={s.slot}
        // Places and tints are the caller's data, with no static home in the stylesheet.
        style={vars}
        data-code={key.code}
        data-held={held.has(key.code) || undefined}
        data-tinted={tint ? true : undefined}
        data-dimmed={mark?.dimmed || undefined}
      >
        <KeyCap className={s.cap} label={key.label ?? keySpecFromCode(key.code, legendOpts).label} font={font} fixed={place !== undefined} />
        {under === undefined ? null : <span className={s.caption}>{under}</span>}
      </span>
    );
  };

  const root = [s.diagram, className].filter(Boolean).join(' ');
  const state = { 'data-lingers': linger !== undefined || undefined, 'data-up': up || undefined, 'data-captioned': captioned || undefined };

  if (!placement) {
    return (
      <span className={[root, s.row].join(' ')} {...state}>
        {(keys ?? []).map((k) => slot(typeof k === 'string' ? { code: k } : k))}
      </span>
    );
  }
  return (
    <div
      className={[root, s.board].join(' ')}
      style={{ '--cols': placement.width, '--rows': placement.height } as CSSProperties}
      {...state}
    >
      {placement.banks.map((bank) => (
        <KeyBank key={bank.id} wrap={wrap}>
          {bank.keys.map((k) => slot(k, k))}
        </KeyBank>
      ))}
    </div>
  );
}

/** Up while `busy`, and for `linger` seconds after; always up without a `linger`. */
function useLinger(busy: boolean, linger: number | undefined): boolean {
  const [wasBusy, setWasBusy] = useState(busy);
  const [lingering, setLingering] = useState(false);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    setLingering(!busy);
  }
  useEffect(() => {
    if (!lingering || linger === undefined) return;
    const timer = setTimeout(() => setLingering(false), linger * 1000);
    return () => clearTimeout(timer);
  }, [lingering, linger]);
  return linger === undefined || busy || lingering;
}
