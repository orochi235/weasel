// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  matchesKeyBinding,
} from 'interactions/keyHelpers';
import { useActionsRegistry } from 'interactions/actions/registry';
import { makeToolHoldAction } from 'interactions/actions/defaults/toolHold';
import { makeToolActivateAction } from 'interactions/actions/defaults/toolActivate';
import { makeToolShortcutAction } from 'interactions/actions/defaults/toolShortcut';
import type { ToolsApi } from './useTools';

export interface UseKeybindingsOptions {
  /** Skip all wiring. Useful for touch apps or test isolation. */
  disable?: boolean;
  /** Tool id Escape switches to. When omitted, defaults to whatever
   *  `tools.active` was when the hook first ran (i.e. the initial active
   *  tool). Pass `null` to disable Escape-returns-to-default behavior. */
  defaultTool?: string | null;
}

/** Key opts for every built-in tool whose activation key lives here rather
 *  than on the ToolDef. Consumed by the tool-select action-registration effect. */
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

/** Hold-action key bindings for built-in tools that engage while a key is held.
 *  Each entry registers a `tool.hold.<toolId>` action via `makeToolHoldAction`. */
const BUILTIN_HOLD_ACTIONS: Record<string, string> = {
  hand: ' ',
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

  // --- Tool-activation keybindings (V/R/T/P/...) and Escape. ---
  // Tool-switch is handled here via a document keydown listener. The
  // `tool.shortcut.*` actions registered below also cover this in contexts where
  // `useGestureDispatcher` is mounted and has access to the actions registry,
  // but this listener is the authoritative path (e.g. tests and consumers that
  // mount Canvas without a full SceneCanvas stack).
  useEffect(() => {
    if (optionsRef.current.disable) return;

    /** Resolve a keydown event to a tool id. */
    function resolveSwitch(e: KeyboardEvent): string | null {
      const reg = toolsRef.current.registry;

      // Phase 1: statically-registered built-in tools.
      for (const id in BUILTIN_SELECT_KEYS) {
        if (!(id in reg)) continue;
        const binding = BUILTIN_SELECT_KEYS[id];
        if (matchesKeyBinding(e, binding)) return id;
      }

      // Phase 2: declared bindings on the ToolDef (configurable tools
      // like useLassoTool, useEyedropperTool).
      for (const id in reg) {
        if (id in BUILTIN_SELECT_KEYS) continue;
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

  // Tool-hold: register `tool.hold.<id>` actions for built-in tools that
  // engage while a key is held. Keys are declared in BUILTIN_HOLD_ACTIONS
  // rather than on the ToolDef so the registration is purely static.
  // `useGestureDispatcher` fires these via key-held bindings.
  const registry = useActionsRegistry();

  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (!registry) return;

    const unregisters: Array<() => void> = [];
    for (const [toolId, key] of Object.entries(BUILTIN_HOLD_ACTIONS)) {
      if (toolsRef.current.has(toolId)) {
        unregisters.push(registry.register(makeToolHoldAction(toolId, key)));
      }
    }
    return () => { for (const u of unregisters) u(); };
  }, [registry, tools]);

  // --- Tool-activate + tool-shortcut: register paired actions per tool.
  // `tool.activate.<id>` owns the effect (calls setActive); it has no binding.
  // `tool.shortcut.<id>` owns the hotkey binding and dispatches the activate
  // action by name via the registry's trigger callback.
  // Built-in tools with static keys come from BUILTIN_SELECT_KEYS; tools
  // whose activation key is configurable via their ToolDef (e.g. useLassoTool)
  // are picked up dynamically from the tools registry.
  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (!registry) return;

    const unregisters: Array<() => void> = [];

    function registerToolPair(toolId: string, keyOpts: { key: string; mod?: boolean; alt?: boolean; shift?: boolean | 'optional' }) {
      unregisters.push(registry!.register(makeToolActivateAction(toolId)));
      unregisters.push(registry!.register(makeToolShortcutAction(toolId, keyOpts, registry!.trigger)));
    }

    // Static registrations for built-in tools whose keys live in this map.
    for (const [toolId, keyOpts] of Object.entries(BUILTIN_SELECT_KEYS)) {
      if (toolsRef.current.has(toolId)) {
        registerToolPair(toolId, keyOpts);
      }
    }

    // Dynamic registrations for any tool that still carries a `.keybinding`
    // field on its ToolDef (e.g. useLassoTool with a caller-provided override).
    // Most built-in tools register their activation key via BUILTIN_SELECT_KEYS;
    // this loop is for tools that want their key to be configurable by the host.
    const allTools = toolsRef.current.registry;
    for (const toolId in allTools) {
      if (toolId in BUILTIN_SELECT_KEYS) continue; // already registered above
      const binding = allTools[toolId].keybinding;
      if (!binding) continue;
      // KeyBinding.key may be an array; makeToolShortcutAction expects a string.
      // Use only the first key in the array case — multi-key aliases are rare
      // in practice and the action system doesn't support them yet.
      const key = typeof binding.key === 'string' ? binding.key : binding.key[0];
      if (!key) continue;
      registerToolPair(toolId, { ...binding, key });
    }

    return () => { for (const u of unregisters) u(); };
  }, [registry, tools]);
}

