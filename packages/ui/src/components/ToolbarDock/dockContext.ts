import { createContext, useContext, useLayoutEffect, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from 'react';

/** What a dock tells the bar it draws: which bar it is, what it is called, and whether it may be moved. */
export interface DockBarContextValue {
  barId: string;
  label: string;
  movable: boolean;
  /** Whether the bar may float, which Alt+Enter on its handle toggles. */
  float?: boolean;
  /** What the handle does with a press: drag the bar. */
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  /** What the handle does with a key: Alt+arrows move the bar, and Alt+Enter floats or docks it. */
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  /** Takes the shortest the bar can be along its line and still draw something past its lead, so a squeezed row leaves it that. */
  onLeast?: (px: number | undefined) => void;
}

/** The dock bar a handle sits in; null where a bar draws itself outside a dock, so the handle stays off. */
export const DockBarContext = createContext<DockBarContextValue | null>(null);

/** Tells the dock drawing this bar, if one is, the shortest the bar can be along its line. */
export function useReportDockLeast(least: number | undefined): void {
  const report = useContext(DockBarContext)?.onLeast;
  useLayoutEffect(() => report?.(least), [report, least]);
}

/** A movable bar's handle: the bar it moves, and the attributes and handlers its lead spreads. */
export interface DockHandle {
  barId: string;
  props: HTMLAttributes<HTMLElement>;
}

const KEYS = 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown';

/** The handle for the bar a movable `ToolbarDock` is drawing, else `null`. */
export function useDockHandle(): DockHandle | null {
  const bar = useContext(DockBarContext);
  if (!bar?.movable) return null;
  return {
    barId: bar.barId,
    props: {
      role: 'button',
      tabIndex: 0,
      'aria-label': `Move ${bar.label} toolbar`,
      'aria-keyshortcuts': bar.float ? `${KEYS} Alt+Enter` : KEYS,
      onPointerDown: bar.onPointerDown,
      onKeyDown: bar.onKeyDown,
    },
  };
}
