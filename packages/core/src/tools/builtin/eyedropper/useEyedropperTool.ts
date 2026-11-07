import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { HotkeyTrigger } from '@weasel-js/routing';
import type { ToolKeybinding } from '@weasel-js/routing';
import type { Action } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import type { ImmediateParams } from '@weasel-js/routing';

/** Options for `useEyedropperTool`. */
export interface UseEyedropperToolOptions {
  /** Called when the user picks a color. `null` means `colorOf` returned
   *  null on a real hit; an empty click is a no-op. */
  onPick: (color: string | null) => void;

  /** Map a node id to a color string, or `null` if the node has no color
   *  to sample. Called with the id of the topmost node under the press. */
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
 * Does not mutate the scene. Click-only; drag is unbound.
 *
 * The node under the click comes from the `nodeAtPoint` dep, so an
 * eyedropper in a consumer that never registered that dep samples nothing.
 */
export function useEyedropperTool(opts: UseEyedropperToolOptions): Tool {
  const onPickRef = useLatest(opts.onPick);
  const colorOfRef = useLatest(opts.colorOf);

  // Closing over the option refs here is what lets the consumer's `onPick`
  // stay a plain callback instead of a dep.
  const pickAction = useMemo<Action>(
    () => ({
      id: 'eyedropper.pick',
      label: 'Eyedropper — sample color',
      // Same tag the tool declares, so a mode that disallows color sampling
      // can't be reached through the gesture either.
      eligible: { capability: 'samples-color' },
      requires: ['nodeAtPoint'],
      invoker: {
        timing: 'immediate' as const,
        run: (deps, params) => {
          const press = (params as ImmediateParams | undefined)?.press;
          if (!press) return;
          const nodeAtPoint = deps.nodeAtPoint;
          const id = nodeAtPoint?.(press) ?? null;
          if (id === null) return;
          onPickRef.current(colorOfRef.current(id));
        },
      },
    }),
    [onPickRef, colorOfRef],
  );

  return useMemo(() => {
    // `null` means omit; the registry reads `undefined` as "no trigger".
    const keybinding =
      opts.keybinding === null ? undefined : (opts.keybinding ?? { key: 'I' });
    const hotkey =
      opts.hotkey === null ? undefined : (opts.hotkey ?? 'alt');

    return defineTool({
      id: 'eyedropper',
      capabilities: ['samples-color'],
      hookName: 'useEyedropperTool',
      keybinding,
      hotkey,
      cursor: cursorFor('eyedropper', { fallback: 'crosshair' }),
      presentation: {
        label: 'Eyedropper',
        icon: icon('eyedropper'),
        group: 'view',
      },
      actions: [pickAction],
      // One binding, no target filter: the action resolves the node itself
      // and no-ops on empty. Sampling deliberately reads the PRESS point
      // rather than the release — a 4px drift between the two can land on a
      // different node, and the color you meant is the one you pressed.
      bindings: [{ spec: { kind: 'click' as const }, actionId: 'eyedropper.pick', opts: { id: 'eyedropper.click' } }],
    });
  }, [opts.keybinding, opts.hotkey, pickAction]);
}
