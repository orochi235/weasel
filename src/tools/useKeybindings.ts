// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  matchesKeyBinding,
  type KeyBinding,
} from 'interactions/actions/useKeybinding';
import { useActionsRegistry } from 'interactions/actions/registry';
import { makeToolHoldAction } from 'interactions/actions/defaults/toolHold';
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

/** Maps a tool's `hotkey` declaration to the literal key string used in a
 *  `key-held` gesture spec. Inverse of the old HOTKEY_TRIGGER_MAP. */
const HOTKEY_KEY: Record<HotkeyTrigger, string> = {
  space: ' ',
  alt: 'Alt',
  ctrl: 'Control',
  meta: 'Meta',
  shift: 'Shift',
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

  // --- Tool-activation keybindings (V/R/T/P/...) ---
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

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // --- Tool-hold: two paths depending on whether an ActionsRegistry is in scope ---
  //
  // WITH ActionsRegistry (SceneCanvas path): register tool.hold.<id> actions so
  // `useGestureDispatcher` can fire them via key-held bindings. No direct
  // keydown/keyup listener needed — the dispatcher handles it.
  //
  // WITHOUT ActionsRegistry (bare Canvas path, pre-Phase-5 compat): add a direct
  // document keydown/keyup listener that calls `engageHotkey`/`disengageHotkey`
  // on the ToolsApi, matching the pre-Phase-5 behavior.
  const registry = useActionsRegistry();

  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (!registry) return;

    const allTools = toolsRef.current.registry;
    const unregisters: Array<() => void> = [];
    for (const toolId in allTools) {
      const tool = allTools[toolId];
      if (!tool.hotkey) continue;
      const key = HOTKEY_KEY[tool.hotkey];
      if (!key) continue;
      const action = makeToolHoldAction(toolId, key);
      unregisters.push(registry.register(action));
    }
    return () => { for (const u of unregisters) u(); };
  }, [registry, tools]);

  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (registry) return; // ActionsRegistry path handles this instead

    function resolveHotkeyTool(key: string): string | null {
      for (const id in toolsRef.current.registry) {
        const tool = toolsRef.current.registry[id];
        if (!tool.hotkey) continue;
        if (HOTKEY_KEY[tool.hotkey] === key) return id;
      }
      return null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const hotkeyTool = resolveHotkeyTool(e.key);
      if (hotkeyTool) {
        toolsRef.current.engageHotkey(hotkeyTool);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const hotkeyTool = resolveHotkeyTool(e.key);
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
  }, [registry]);
}
