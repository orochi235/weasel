// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  matchesKeyBinding,
  type KeyBinding,
} from 'interactions/actions/useKeybinding';
import type { ToolsApi } from './useTools';
import type { HotkeyTrigger } from './types';

export interface UseKeybindingsOptions {
  /** Per-tool keybinding override, keyed by tool id. Wins over the tool's
   *  declared `keybinding`. Pass `null` as the value to unbind the tool
   *  entirely. Tools not present in this map keep their declared binding. */
  overrides?: Record<string, KeyBinding | null>;
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

    /** Resolve a keydown event to a tool id. Overrides take priority: an
     *  overridden tool's `KeyBinding` is checked first, and an overridden
     *  tool's *declared* binding is suppressed entirely (so remapping pen
     *  to V silences select's declared V). Pass `null` as an override value
     *  to unbind a tool without rebinding it. */
    function resolveSwitch(e: KeyboardEvent): string | null {
      const overrides = optionsRef.current.overrides;
      const reg = toolsRef.current.registry;

      // Phase 1: overrides take priority.
      if (overrides) {
        for (const id in overrides) {
          if (!(id in reg)) continue;
          const ov = overrides[id];
          if (ov && matchesKeyBinding(e, ov)) return id;
        }
      }

      // Phase 2: declared bindings, skipping any tool with an override entry
      // (whether re-binding or null-unbinding).
      for (const id in reg) {
        if (overrides && id in overrides) continue;
        const binding = reg[id].keybinding;
        if (!binding) continue;
        if (matchesKeyBinding(e, binding)) return id;
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

      // Modifier engagement first — modifier keys (space, alt, etc.)
      // never double as switch keybindings. Bare modifier keys arrive
      // without a meta/ctrl combo, so this also bypasses the system-
      // shortcut concern below.
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

      const switchTo = resolveSwitch(e);
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
