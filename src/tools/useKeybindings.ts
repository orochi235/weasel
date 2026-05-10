// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import { isEditableTarget } from 'interactions/actions/useKeybinding';
import type { ToolsApi } from './useTools';
import type { HotkeyTrigger } from './types';

export interface UseKeybindingsOptions {
  /** Override map: physical key → tool id. Wins over the tool's declared
   *  keybinding. Pass `null` as the value to unbind a key entirely. */
  overrides?: Record<string, string | null>;
  /** Skip all wiring. Useful for touch apps or test isolation. */
  disable?: boolean;
  /** Tool id Escape switches to. When omitted, defaults to whatever
   *  `tools.active` was when the hook first ran (i.e. the initial active
   *  tool). Pass `null` to disable Escape-returns-to-default behavior. */
  defaultTool?: string | null;
}

const HOTKEY_TRIGGER_MAP: Record<string, HotkeyTrigger> = {
  ' ': 'space',
  Alt: 'alt',
  Control: 'ctrl',
  Meta: 'meta',
  Shift: 'shift',
};

export function useKeybindings(
  tools: ToolsApi,
  options: UseKeybindingsOptions = {},
): void {
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // Snapshot the initial active tool — used as the Escape target when the
  // consumer doesn't pass an explicit `defaultTool`. Captured in a ref
  // (not state) so it survives re-renders without re-syncing.
  const initialActiveRef = useRef(tools.active);

  useEffect(() => {
    if (optionsRef.current.disable) return;

    function resolveSwitch(key: string): string | null {
      const o = optionsRef.current.overrides;
      if (o && key in o) return o[key]; // explicit override (may be null = unbind)
      const reg = toolsRef.current.registry;
      for (const id in reg) {
        if (reg[id].keybinding && reg[id].keybinding!.toLowerCase() === key.toLowerCase()) {
          return id;
        }
      }
      return null;
    }

    function resolveHotkeyEngage(key: string): string | null {
      const trigger = HOTKEY_TRIGGER_MAP[key];
      if (!trigger) return null;
      const reg = toolsRef.current.registry;
      for (const id in reg) {
        if (reg[id].hotkey === trigger) return id;
      }
      return null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      // Let system/browser shortcuts through (Cmd-R reload, Cmd-S save,
      // Cmd-+/- zoom, Ctrl-Shift-anything, etc.) — these never map to
      // tool switches. Modifier engagement still uses bare modifier keys
      // (handled below) which arrive without a meta/ctrl combo.
      if (e.metaKey || e.ctrlKey) return;

      // Modifier engagement first — modifier keys (space, alt, etc.)
      // never double as switch keybindings.
      const hotkeyTool = resolveHotkeyEngage(e.key);
      if (hotkeyTool) {
        toolsRef.current.engageHotkey(hotkeyTool);
        return;
      }

      // Escape: return to the default tool. The opt's `defaultTool`
      // wins; when undefined, fall back to the snapshotted initial
      // active. `null` disables the behavior entirely.
      if (e.key === 'Escape') {
        const opt = optionsRef.current.defaultTool;
        const target = opt === null ? null : (opt ?? initialActiveRef.current);
        if (target && toolsRef.current.has(target) && toolsRef.current.active !== target) {
          e.preventDefault();
          toolsRef.current.setActive(target);
          return;
        }
      }

      const switchTo = resolveSwitch(e.key);
      if (switchTo) {
        e.preventDefault();
        toolsRef.current.setActive(switchTo);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const hotkeyTool = resolveHotkeyEngage(e.key);
      if (hotkeyTool && toolsRef.current.hotkeyEngaged === hotkeyTool) {
        toolsRef.current.disengageHotkey();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
