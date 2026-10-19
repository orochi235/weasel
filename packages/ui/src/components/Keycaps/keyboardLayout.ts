import type { Platform } from '@weasel-js/gestures';

/** One key of a {@link KeyboardLayout}, named by the `KeyboardEvent.code` it sends. A bare string is a one-unit key. */
export type KeyboardKey = string | {
  code: string;
  /** In key units, where a letter key is one. Defaults to 1. */
  width?: number;
  /** What it prints, where that is not its code's legend on the platform. */
  label?: string;
};

/** Empty space in a row, in key units. */
export interface KeyboardGap {
  gap: number;
}

/** A row of a bank, left to right. The object form sets its offset from the bank's top, in key units;
 *  otherwise a row sits one unit below the last. */
export type KeyboardRow = readonly (KeyboardKey | KeyboardGap)[] | { y: number; keys: readonly (KeyboardKey | KeyboardGap)[] };

/** Keys a keyboard groups, whose legends print at one size: its function row, main block, or arrows. */
export interface KeyboardBank {
  id: string;
  /** The bank's top-left corner, in key units. */
  x: number;
  y: number;
  rows: readonly KeyboardRow[];
}

/** Where a keyboard's keys sit, and how it groups them. */
export interface KeyboardLayout {
  id: string;
  /** Whose legends its keys print. A `KeyDiagram` without its own `platform` uses this. */
  platform?: Platform;
  banks: readonly KeyboardBank[];
}

const keys = (codes: string) => codes.split(' ');
const wide = (code: string, width: number): KeyboardKey => ({ code, width });

/** An ANSI tenkeyless keyboard as `platform` builds one: a Mac's bottom row has fn, Control, Option, and
 *  Command, and anyone else's Ctrl, Win, Alt, and Menu. */
export function ansiLayout(platform: Platform): KeyboardLayout {
  const bottom: KeyboardRow = platform === 'macos'
    ? [wide('Fn', 1.25), wide('ControlLeft', 1.25), wide('AltLeft', 1.25), wide('MetaLeft', 1.5), wide('Space', 7),
       wide('MetaRight', 1.5), wide('AltRight', 1.25)]
    : [wide('ControlLeft', 1.25), wide('MetaLeft', 1.25), wide('AltLeft', 1.25), wide('Space', 6.25),
       wide('AltRight', 1.25), wide('MetaRight', 1.25), wide('ContextMenu', 1.25), wide('ControlRight', 1.25)];
  return {
    id: `ansi-${platform}`,
    platform,
    banks: [
      {
        id: 'function',
        x: 0,
        y: 0,
        rows: [['Escape', { gap: 1 }, ...keys('F1 F2 F3 F4'), { gap: 0.5 }, ...keys('F5 F6 F7 F8'), { gap: 0.5 }, ...keys('F9 F10 F11 F12')]],
      },
      {
        id: 'main',
        x: 0,
        y: 1.25,
        rows: [
          [...keys('Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal'), wide('Backspace', 2)],
          [wide('Tab', 1.5), ...keys('KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight'), wide('Backslash', 1.5)],
          [wide('CapsLock', 1.75), ...keys('KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote'), wide('Enter', 2.25)],
          [wide('ShiftLeft', 2.25), ...keys('KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash'), wide('ShiftRight', 2.75)],
          bottom,
        ],
      },
      {
        id: 'navigation',
        x: 15.5,
        y: 0,
        rows: [keys('PrintScreen ScrollLock Pause'), { y: 1.25, keys: keys('Insert Home PageUp') }, keys('Delete End PageDown')],
      },
      {
        id: 'arrows',
        x: 15.5,
        y: 4.25,
        rows: [[{ gap: 1 }, 'ArrowUp'], keys('ArrowLeft ArrowDown ArrowRight')],
      },
    ],
  };
}

/** {@link ansiLayout} for each platform. */
export const KEYBOARD_LAYOUTS: Readonly<Record<Platform, KeyboardLayout>> = {
  macos: ansiLayout('macos'),
  windows: ansiLayout('windows'),
  linux: ansiLayout('linux'),
};

/** A key with its place worked out, in key units from the diagram's top-left. */
export interface PlacedKey {
  code: string;
  label?: string;
  x: number;
  y: number;
  width: number;
}

/** A bank's keys with their places worked out. */
export interface PlacedBank {
  id: string;
  keys: readonly PlacedKey[];
}

/** A layout's keys placed, and the box they need, in key units. */
export interface Placement {
  banks: readonly PlacedBank[];
  width: number;
  height: number;
}

const keyCode = (key: KeyboardKey) => (typeof key === 'string' ? key : key.code);
const isRowArray = (row: KeyboardRow): row is readonly (KeyboardKey | KeyboardGap)[] => Array.isArray(row);

/**
 * Places a layout's keys. Given `only`, it keeps just the keys those codes name, drops any bank left
 * empty, and moves what remains to the top-left, so a few keys take only the room they need.
 */
export function placeKeys(layout: KeyboardLayout, only?: ReadonlySet<string>): Placement {
  const banks: PlacedBank[] = [];
  for (const bank of layout.banks) {
    const placed: PlacedKey[] = [];
    let y = 0;
    bank.rows.forEach((row, i) => {
      const items = isRowArray(row) ? row : row.keys;
      if (!isRowArray(row)) y = row.y;
      else if (i > 0) y += 1;
      let x = 0;
      for (const item of items) {
        if (typeof item !== 'string' && 'gap' in item) {
          x += item.gap;
          continue;
        }
        const width = typeof item === 'string' ? 1 : item.width ?? 1;
        const code = keyCode(item);
        if (!only || only.has(code)) {
          const label = typeof item === 'string' ? undefined : item.label;
          placed.push({ code, ...(label === undefined ? {} : { label }), x: bank.x + x, y: bank.y + y, width });
        }
        x += width;
      }
    });
    if (placed.length > 0) banks.push({ id: bank.id, keys: placed });
  }
  const all = banks.flatMap((b) => b.keys);
  if (all.length === 0) return { banks, width: 0, height: 0 };
  const left = Math.min(...all.map((k) => k.x));
  const top = Math.min(...all.map((k) => k.y));
  const moved = banks.map((b) => ({ id: b.id, keys: b.keys.map((k) => ({ ...k, x: k.x - left, y: k.y - top })) }));
  const keysMoved = moved.flatMap((b) => b.keys);
  return {
    banks: moved,
    width: Math.max(...keysMoved.map((k) => k.x + k.width)),
    height: Math.max(...keysMoved.map((k) => k.y + 1)),
  };
}
