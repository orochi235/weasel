import {
  EMPTY_TYPEAHEAD, IDLE_PRESS, TYPEAHEAD_RESET_MS, pressStep, rowKey, typeaheadStep,
  type ListMode, type PressState, type TypeaheadBuffer,
} from '@weasel-js/ui-logic';
import type { HudKeyEvent, HudPointerEvent } from '../../widget';
import type { HudListRow } from './drawList';

/** Where the keyboard and pointer are in a HUD list, and what they do to it. Each handler returns whether it
 *  changed what the list draws. */
export interface ListNav {
  readonly active: number | null;
  readonly hover: number | null;
  /** The active row shows its ring: the list holds focus, and the keyboard moved last. */
  readonly ring: boolean;
  pointer(evt: HudPointerEvent, rowAt: (x: number, y: number) => number | null): boolean;
  /** `handled` false for a key that falls through to the canvas. */
  key(evt: HudKeyEvent): { handled: boolean; changed: boolean };
  focus(focused: boolean): boolean;
  /** The rows changed: keep the active and hovered rows in range. */
  clamp(): void;
}

/** A list's keyboard and pointer, over `rows()`, calling `activate` for a pressed or Enter'd row. */
export function createListNav(
  rows: () => readonly HudListRow[], mode: ListMode, activate: (i: number) => void,
): ListNav {
  let active: number | null = null;
  let hover: number | null = null;
  let press: PressState = IDLE_PRESS;
  let pressRow: number | null = null;
  let focused = false;
  let keyed = false;
  let typed: TypeaheadBuffer = EMPTY_TYPEAHEAD;
  const live = mode !== 'list';
  const home = () => {
    const all = rows();
    const sel = all.findIndex((r) => r.selected);
    return sel >= 0 ? sel : all.length ? 0 : null;
  };

  return {
    get active() { return active; },
    get hover() { return hover; },
    get ring() { return focused && keyed; },
    pointer(evt, rowAt) {
      switch (evt.type) {
        case 'down': {
          const i = rowAt(evt.x, evt.y);
          keyed = false;
          press = pressStep(press, { type: 'down' }).state;
          pressRow = i;
          if (i !== null && live) active = i;
          return true;
        }
        case 'up': {
          const step = pressStep(press, { type: 'up', inside: rowAt(evt.x, evt.y) === pressRow });
          press = step.state;
          if (step.pressed && live && pressRow !== null) activate(pressRow);
          pressRow = null;
          return false;
        }
        case 'cancel': press = IDLE_PRESS; pressRow = null; return false;
        case 'hovermove': {
          const i = rowAt(evt.x, evt.y);
          if (i === hover) return false;
          hover = i;
          return true;
        }
        case 'hoverleave': {
          if (hover === null) return false;
          hover = null;
          return true;
        }
        default: return false;
      }
    },
    key(evt) {
      const all = rows();
      if (evt.type !== 'keydown' || !live || all.length === 0) return { handled: false, changed: false };
      const at = active ?? home() ?? 0;
      const searching = typed.text !== '' && Date.now() - typed.at < TYPEAHEAD_RESET_MS;
      const action = rowKey(all, at, evt, { activate: true, typeahead: true }, searching);
      if (!action) return { handled: false, changed: false };
      keyed = true;
      if (action.kind === 'move') active = action.at ?? active;
      else if (action.kind === 'activate') activate(at);
      else if (action.kind === 'type') {
        const t = typeaheadStep(all, at, typed, evt.key, Date.now(), { label: (r) => r.label });
        typed = t.buffer;
        if (t.hit !== null) active = t.hit;
        else if (!action.held) return { handled: false, changed: true };
      }
      return { handled: true, changed: true };
    },
    focus(f) {
      focused = f;
      if (f && active === null) active = home();
      return true;
    },
    clamp() {
      const n = rows().length;
      if (active !== null && active >= n) active = n ? n - 1 : null;
      if (hover !== null && hover >= n) hover = null;
    },
  };
}
