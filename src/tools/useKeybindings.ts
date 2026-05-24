// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  matchesKeyBinding,
} from 'interactions/keyHelpers';
import { useActionsRegistry } from 'interactions/actions/registry';
import {
  makeToolOffhandAction,
  buildToolOffhandBindings,
  type ToolOffhandBindingSpec,
} from 'interactions/actions/defaults/toolOffhand';
import {
  makeToolActivateAction,
  buildToolActivateBindings,
  type ToolActivateBindingSpec,
} from 'interactions/actions/defaults/toolActivate';
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

/** Offhand-action key bindings for built-in tools that engage while a key
 *  is held (e.g. Space-for-hand). Each entry contributes one
 *  `BoundGesture` to the consolidated `tool.offhand` action's
 *  `defaultBinding[]`. */
const BUILTIN_OFFHAND_ACTIONS: Record<string, string> = {
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
  // consolidated `tool.activate` action registered below carries the same
  // bindings in its `defaultBinding[]` (for discoverability via the registry
  // and for any dispatcher-driven surface), but this document listener is
  // the authoritative path (e.g. tests and consumers that mount Canvas
  // without a full SceneCanvas stack).
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

  // Tool-offhand: register one parametric `tool.offhand` action whose
  // `defaultBinding[]` carries one key-held entry per built-in tool that
  // engages while a key is held (e.g. Space-for-hand). Keys are declared in
  // BUILTIN_OFFHAND_ACTIONS rather than on the ToolDef so the registration
  // is purely static. `useGestureDispatcher` fires these via key-held
  // bindings; the invoker reads `params.toolId` from the matched binding.
  const registry = useActionsRegistry();

  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (!registry) return;

    const specs: ToolOffhandBindingSpec[] = [];
    for (const [toolId, key] of Object.entries(BUILTIN_OFFHAND_ACTIONS)) {
      if (toolsRef.current.has(toolId)) {
        specs.push({ toolId, key });
      }
    }
    if (specs.length === 0) return;

    const bindings = buildToolOffhandBindings(specs);
    return registry.register(makeToolOffhandAction(bindings));
  }, [registry, tools]);

  // --- Tool-activate: register one parametric `tool.activate` action.
  // The single descriptor carries a `defaultBinding: BoundGesture[]` with one
  // entry per tool — each entry pairs a key spec with `opts.params.toolId`.
  // The invoker reads `params.toolId` and calls `setActive`. Imperative
  // callers (palette, toolbar) reach the same effect via
  // `registry.trigger('tool.activate', { toolId })`.
  //
  // Built-in tools with static keys come from BUILTIN_SELECT_KEYS; tools
  // whose activation key is configurable via their ToolDef (e.g. useLassoTool)
  // are picked up dynamically from the tools registry.
  useEffect(() => {
    if (optionsRef.current.disable) return;
    if (!registry) return;

    const specs: ToolActivateBindingSpec[] = [];

    for (const [toolId, keyOpts] of Object.entries(BUILTIN_SELECT_KEYS)) {
      if (toolsRef.current.has(toolId)) {
        specs.push({ toolId, keyOpts });
      }
    }

    const allTools = toolsRef.current.registry;
    for (const toolId in allTools) {
      if (toolId in BUILTIN_SELECT_KEYS) continue;
      const binding = allTools[toolId].keybinding;
      if (!binding) continue;
      // KeyBinding.key may be an array; the consolidated action's per-entry
      // key spec expects a string. Take the first key in the array case —
      // multi-key aliases are rare in practice and the action system doesn't
      // support them yet.
      const key = typeof binding.key === 'string' ? binding.key : binding.key[0];
      if (!key) continue;
      specs.push({ toolId, keyOpts: { ...binding, key } });
    }

    if (specs.length === 0) return;

    const bindings = buildToolActivateBindings(specs);
    const unregister = registry.register(makeToolActivateAction(bindings));
    return unregister;
  }, [registry, tools]);
}

