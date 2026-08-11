// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import { useActionsRegistry } from 'interactions/actions/registry';
import {
  makeToolActivateAction,
  buildToolActivateBindings,
  type ToolActivateBindingSpec,
} from 'interactions/actions/defaults/toolActivate';
import { makeToolResetToDefaultAction } from 'interactions/actions/defaults/toolResetToDefault';
import type { ToolsApi } from './useTools';

export interface UseKeybindingsOptions {
  /** Skip all wiring. Useful for touch apps or test isolation. */
  disable?: boolean;
  /** Tool id Escape switches to. When omitted, defaults to whatever
   *  `tools.active` was when the hook first ran (i.e. the initial active
   *  tool). Pass `null` to disable Escape-returns-to-default behavior. */
  defaultTool?: string | null;
  /**
   * Gate for keyboard tool activation: return false to refuse a tool the
   * active mode doesn't allow. `<SceneCanvas>` wires this from
   * `getActiveMode` + each tool's `capabilities`, using the same predicate
   * `ToolPalette` uses to grey a button out — so the grey-out becomes a
   * guarantee rather than a hint.
   *
   * Omit for consumers with no mode registry: every tool stays activatable.
   */
  isToolEligible?: (toolId: string) => boolean;
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

  // Held-key engagement is not here: a tool declares `ToolDef.hotkey` and
  // assembly registers `tool.offhand` from the declaration.
  const registry = useActionsRegistry();

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
      // `KeyBinding.key` may be an array of aliases. Emit one binding per
      // key: the old document listener matched every alias while this path
      // only took `key[0]`, so a multi-key tool activated on all its keys
      // through one route and only the first through the other.
      const keys = typeof binding.key === 'string' ? [binding.key] : binding.key;
      for (const key of keys) {
        if (!key) continue;
        specs.push({ toolId, keyOpts: { ...binding, key } });
      }
    }

    const unregisters: Array<() => void> = [];

    if (specs.length > 0) {
      const bindings = buildToolActivateBindings(specs);
      unregisters.push(registry.register(makeToolActivateAction(
        bindings,
        (toolId) => optionsRef.current.isToolEligible?.(toolId) ?? true,
      )));
    }

    // Escape-returns-to-default. Registered here rather than in the deleted
    // document listener so it competes in the dispatcher's Escape ladder
    // instead of firing in parallel with it — see
    // `makeToolResetToDefaultAction` for the ordering and the behavior
    // change that implies.
    unregisters.push(registry.register(makeToolResetToDefaultAction(() => {
      const opt = optionsRef.current.defaultTool;
      if (opt === null) return null;
      const target = opt ?? initialActiveRef.current;
      if (!target) return null;
      const api = toolsRef.current;
      if (!api.has(target) || api.active === target) return null;
      return target;
    })));

    return () => { for (const u of unregisters) u(); };
  }, [registry, tools]);
}

