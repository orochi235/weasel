// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  matchesKeyBinding,
  type KeyBinding,
} from 'interactions/keyHelpers';
import { useActionsRegistry } from 'interactions/actions/registry';
import { makeToolHoldAction } from 'interactions/actions/defaults/toolHold';
import { makeToolSelectAction } from 'interactions/actions/defaults/toolSelect';
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

/** Key opts for every built-in tool that has migrated away from ToolDef.keybinding.
 *  Updated in Task 9; consumed by resolveSwitch and the tool-select registration effect. */
const BUILTIN_SELECT_KEYS: Record<string, { key: string }> = {
  select: { key: 'V' },
  rect: { key: 'R' },
  ellipse: { key: 'E' },
  line: { key: '\\' },
  polygon: { key: 'G' },
  pencil: { key: 'N' },
  text: { key: 'T' },
  hand: { key: 'H' },
  pen: { key: 'P' },
};

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

      // Phase 2a: statically-migrated built-in tools (keybinding removed from
      // ToolDef in Task 9; key lives in BUILTIN_SELECT_KEYS instead).
      for (const id in BUILTIN_SELECT_KEYS) {
        if (overrides && id in overrides) continue;
        if (!(id in reg)) continue; // tool not registered with this tools instance
        const binding = BUILTIN_SELECT_KEYS[id];
        if (matchesKeyBinding(e, binding)) return id;
      }

      // Phase 2b: declared bindings on the ToolDef (tools not yet migrated,
      // e.g. useLassoTool with a configurable key).
      for (const id in reg) {
        if (overrides && id in overrides) continue;
        if (id in BUILTIN_SELECT_KEYS) continue; // already handled above
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

  // Tool-hold: register `tool.hold.<id>` actions into the surrounding
  // `ActionsRegistry` so `useGestureDispatcher` can fire them via key-held
  // bindings. `useTools` already requires an `<ActiveToolContextProvider>`,
  // and the kit's standard wrappers (`<WeaselProvider>`, `<SceneCanvas>`)
  // mount the actions registry alongside it — so there's no separate
  // "no registry" fallback path.
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

  // --- Tool-select: register `tool.select.<id>` actions into the actions
  // registry. Built-in tools with static keys are registered from the
  // BUILTIN_SELECT_KEYS map below. Tools whose key is configurable via
  // their ToolDef (e.g. useLassoTool) are picked up dynamically from the
  // registry. Both run alongside the legacy keydown handler (which fires
  // until Task 10 removes it).
  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (!registry) return;

    const unregisters: Array<() => void> = [];

    // Static registrations for built-in tools whose keys are now in this map
    // rather than on the ToolDef.
    for (const [toolId, keyOpts] of Object.entries(BUILTIN_SELECT_KEYS)) {
      if (toolsRef.current.has(toolId)) {
        unregisters.push(registry.register(makeToolSelectAction(toolId, keyOpts)));
      }
    }

    // Dynamic registrations for any tool that still carries a `.keybinding`
    // field on its ToolDef (e.g. useLassoTool with a caller-provided override).
    const allTools = toolsRef.current.registry;
    for (const toolId in allTools) {
      if (toolId in BUILTIN_SELECT_KEYS) continue; // already registered above
      const binding = allTools[toolId].keybinding;
      if (!binding) continue;
      unregisters.push(registry.register(makeToolSelectAction(toolId, binding)));
    }

    return () => { for (const u of unregisters) u(); };
  }, [registry, tools]);
}

