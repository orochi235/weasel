// src/tools/useKeybindings.ts
import { useEffect, useRef } from 'react';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { defaultToolOf, eligibleForMode, type ModeRegistry } from '@weasel-js/modes';
import {
  makeToolActivateAction,
  buildToolActivateBindings,
  type ToolActivateBindingSpec,
} from 'interactions/actions/defaults/toolActivate';
import { makeToolResetToDefaultAction } from 'interactions/actions/defaults/toolResetToDefault';
import { makeToolModeDefaultAction } from 'interactions/actions/defaults/toolModeDefault';
import type { ToolsApi } from './overlayBinding';

/** Options for `useKeybindings`. */
export interface UseKeybindingsOptions {
  /** Skip all wiring. Useful for touch apps or test isolation. */
  disable?: boolean;
  /** Tool id Escape switches to. When omitted, defaults to whatever
   *  `tools.active` was when the hook first ran (i.e. the initial active
   *  tool). Pass `null` to disable Escape-returns-to-default behavior. */
  defaultTool?: string | null;
  /**
   * The modes that gate keyboard tool activation: a key is refused when the
   * active mode does not allow every tag in the tool's
   * `eligibility.capabilities` — the predicate `ToolPalette` greys a button
   * out by, so the grey-out is a guarantee rather than a hint. `<SceneCanvas>`
   * passes its `modes` prop, whoever built the `ToolsApi`.
   *
   * Omit for consumers with no mode registry: every tool stays activatable.
   */
  modes?: ModeRegistry;
}

/** Wire the single-key tool-activation shortcuts (V, P, T, …), Escape to
 *  return to the active mode's `defaultTool`, and Escape to return to the
 *  default tool. Activation is gated on what the active mode
 *  allows, so a key cannot reach a tool the palette greys out. */
export function useKeybindings(
  tools: ToolsApi,
  options: UseKeybindingsOptions = {},
): void {
  const toolsRef = useLatest(tools);
  const optionsRef = useLatest(options);
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
  // Every key comes from a `ToolDef.keybinding` in the tools registry.
  const { disable = false } = options;
  useEffect(() => {
    if (disable) return;
    if (!registry) return;
    // No tools, no tool keys: nothing to activate and nothing to return to.
    if (Object.keys(toolsRef.current.registry).length === 0) return;

    const specs: ToolActivateBindingSpec[] = [];

    const allTools = toolsRef.current.registry;
    for (const toolId in allTools) {
      const binding = allTools[toolId].keybinding;
      if (!binding) continue;
      // `KeyBinding.key` may be an array of aliases: one binding per key.
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
        (toolId) => {
          const modes = optionsRef.current.modes;
          if (!modes) return true;
          const tags = toolsRef.current.registry[toolId]?.eligibility.capabilities;
          return eligibleForMode(modes.current(), tags ?? []);
        },
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

    unregisters.push(registry.register(makeToolModeDefaultAction(() => {
      const modes = optionsRef.current.modes;
      if (!modes) return null;
      const api = toolsRef.current;
      const target = defaultToolOf(modes.current(), api.has);
      return target !== null && api.active !== target ? target : null;
    })));

    return () => { for (const u of unregisters) u(); };
  }, [registry, tools, toolsRef, optionsRef, disable]);
}

