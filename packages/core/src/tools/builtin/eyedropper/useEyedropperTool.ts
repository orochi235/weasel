import { useMemo, useRef, createElement } from 'react';
import { defineTool } from '../../routing';
import type { Tool, HotkeyTrigger } from '../../types';
import type { ToolKeybinding } from '../../routing/types';
import type { Action } from 'interactions/actions/registry';
import type { NodeAtPointDep } from 'interactions/actions/depSchema';
import { EyedropperIcon } from '../../../icons';

export interface UseEyedropperToolOptions {
  /** Called when the user picks a color. `null` means "no node was hit
   *  with a color" — currently only reachable when `colorOf` returns null
   *  on a real hit; empty-click is a no-op in v1. */
  onPick: (color: string | null) => void;

  /** Map a node id to a color string, or `null` if the node has no color
   *  to sample. Called on click with the id of the topmost node under the
   *  click point. */
  colorOf: (id: string) => string | null;

  /** Override the default `{ key: 'I' }` keybinding. Pass `null` to omit
   *  the keybinding entirely (palette-only or hotkey-only wiring). */
  keybinding?: ToolKeybinding | null;

  /** Override the default `'alt'` hotkey trigger. Pass `null` to omit. */
  hotkey?: HotkeyTrigger | null;
}

/**
 * Eyedropper. Click a node to sample its color; the consumer's `onPick`
 * callback decides where the color goes. Engages as a sticky active-slot
 * tool (`I` keybinding) and as a momentary hotkey-slot tool while Alt
 * is held — consumers can override either trigger to `null`.
 *
 * Pure-read tool — does NOT mutate the scene. v1 is click-only; drag is
 * unbound (a future drag-to-sample option is additive).
 *
 * The node under the click comes from the `nodeAtPoint` dep, so an
 * eyedropper in a consumer that never registered that dep samples nothing.
 * `<SceneCanvas>` sources it from the same picker the rest of the kit hits.
 */
export function useEyedropperTool(opts: UseEyedropperToolOptions): Tool<null> {
  const onPickRef = useRef(opts.onPick);
  onPickRef.current = opts.onPick;
  const colorOfRef = useRef(opts.colorOf);
  colorOfRef.current = opts.colorOf;

  // Registered by `useToolActions` from inside the ActionsProvider — see
  // `ToolDef.actions`. Closing over the option refs here is what lets the
  // consumer's `onPick` stay a plain callback instead of a dep.
  const pickAction = useMemo<Action>(
    () => ({
      id: 'eyedropper.pick',
      label: 'Eyedropper — sample color',
      // Same tag the tool declares, so a mode that disallows color sampling
      // can't be reached through the gesture either. The tool's own
      // eligibility already gates activation; this closes the gesture side.
      eligible: { capability: 'samples-color' },
      requires: ['nodeAtPoint'],
      invoker: {
        timing: 'immediate' as const,
        run: (deps, params) => {
          const p = params as { pressX?: number; pressY?: number } | undefined;
          if (p?.pressX === undefined || p.pressY === undefined) return;
          const nodeAtPoint = deps.nodeAtPoint as NodeAtPointDep | undefined;
          const id = nodeAtPoint?.({ x: p.pressX, y: p.pressY }) ?? null;
          // Empty click is a no-op in v1 — `onPick(null)` is reserved for
          // "hit a node that has no color to sample."
          if (id === null) return;
          onPickRef.current(colorOfRef.current(id));
        },
      },
    }),
    [],
  );

  return useMemo(() => {
    // Resolve overrides. The spec says `null` => omit; defineTool reads
    // these directly into the returned Tool, and the registry treats
    // `undefined` as "no trigger." Convert null → undefined here.
    const keybinding =
      opts.keybinding === null ? undefined : (opts.keybinding ?? { key: 'I' });
    const hotkey =
      opts.hotkey === null ? undefined : (opts.hotkey ?? 'alt');

    return defineTool<null>({
      id: 'eyedropper',
      capabilities: ['samples-color'],
      hookName: 'useEyedropperTool',
      keybinding,
      hotkey,
      cursor: 'crosshair',
      presentation: {
        label: 'Eyedropper',
        icon: createElement(EyedropperIcon),
        group: 'view',
      },
      actions: [pickAction],
      // One binding, no target filter: the action resolves the node itself
      // and no-ops on empty. Sampling deliberately reads the PRESS point
      // rather than the release — a 4px drift between the two can land on a
      // different node, and the color you meant is the one you pressed.
      //
      // The eyedropper used to carry a `pointerDown` route that existed only
      // to claim the press before `useSelectTool`'s own always-claiming
      // pointerdown route could. That was an artifact of two dispatchers
      // racing; hotkey scope now outranks active scope in the one dispatcher
      // that remains, so holding Alt wins without a gate.
      bindings: [{ spec: { kind: 'click' as const }, actionId: 'eyedropper.pick' }],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.keybinding, opts.hotkey, pickAction]);
}
