import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { HotkeyTrigger } from '@weasel-js/routing';
import type { ToolKeybinding } from '@weasel-js/routing';
import type { Action } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import type { ActionDeps, ImmediateParams, WorldPoint } from '@weasel-js/routing';
import { viewWorldToScreen } from '@weasel-js/geom';
import { THROUGH_CHROME } from '../throughChrome';

/** Options for `useEyedropperTool`. */
export interface UseEyedropperToolOptions {
  /** Called when the user picks a color. `null` means `colorOf` returned
   *  null on a real hit; an empty click is a no-op. */
  onPick: (color: string | null) => void;

  /**
   * Sample a node's declared color instead of pixels: map the id of the
   * topmost node under the press to its color, or `null` if it has none.
   * Omitted, the tool samples the pixel under the press through the
   * `colorAt` dep — on `<SceneCanvas>`, its document layers drawn again at
   * that point, with no chrome in them.
   */
  colorOf?: (id: string) => string | null;

  /** Override the default `{ key: 'I' }` keybinding. Pass `null` to omit
   *  the keybinding entirely (palette-only or hotkey-only wiring). */
  keybinding?: ToolKeybinding | null;

  /** A modifier that engages the tool while held (`'alt'`). Default none: a held
   *  Alt would shadow every other tool's Alt-click. `null` also means none. */
  hotkey?: HotkeyTrigger | null;
}


/** The press in the screen space `colorAt` reads: through the canvas's view,
 *  or as it came where no view is sourced — a 3D host, whose dispatcher hands
 *  actions screen points to begin with. */
function screenOf(deps: ActionDeps, press: WorldPoint): { x: number; y: number } {
  const view = deps.view?.get();
  return view ? viewWorldToScreen(view, press) : press;
}

/**
 * Eyedropper. Click to sample a color; the consumer's `onPick` callback
 * decides where it goes. Engages as a sticky active-slot tool (`I`
 * keybinding, or `null` for none), and as a momentary hotkey-slot tool only
 * while a `hotkey` its caller names is held.
 *
 * Does not mutate the scene. Click-only; drag is unbound.
 *
 * By default it samples the pixel under the press, through the `colorAt` dep
 * at the press's screen point (the `view` dep maps it there), and a click on
 * nothing drawn picks nothing. Given `colorOf`, it samples the node under the
 * press instead, which comes from the `nodeAtPoint` dep. Either way, a
 * consumer that never registered the dep samples nothing.
 */
export function useEyedropperTool(opts: UseEyedropperToolOptions): Tool {
  const onPickRef = useLatest(opts.onPick);
  const colorOfRef = useLatest(opts.colorOf);

  // Closing over the option refs here is what lets the consumer's `onPick`
  // stay a plain callback instead of a dep.
  const pickAction = useMemo<Action>(() => {
    // Presses so far: an answer `colorAt` gives late reports only if no press has come since.
    let presses = 0;
    return {
      id: 'eyedropper.pick',
      label: 'Eyedropper — sample color',
      // Same tag the tool declares, so a mode that disallows color sampling
      // can't be reached through the gesture either.
      eligible: { capability: 'samples-color' },
      requires: ['nodeAtPoint', 'colorAt', 'view'],
      invoker: {
        timing: 'immediate' as const,
        run: (deps, params) => {
          const press = (params as ImmediateParams | undefined)?.press;
          if (!press) return;
          const mine = ++presses;
          const colorOf = colorOfRef.current;
          if (colorOf) {
            const id = deps.nodeAtPoint?.(press) ?? null;
            if (id !== null) onPickRef.current(colorOf(id));
            return;
          }
          const got = deps.colorAt?.(screenOf(deps, press)) ?? null;
          const report = (hex: string | null) => { if (hex !== null && mine === presses) onPickRef.current(hex); };
          if (got instanceof Promise) void got.then(report, () => undefined);
          else report(got);
        },
      },
    };
  }, [onPickRef, colorOfRef]);

  return useMemo(() => {
    // `null` means omit; the registry reads `undefined` as "no trigger".
    const keybinding =
      opts.keybinding === null ? undefined : (opts.keybinding ?? { key: 'I' });
    const hotkey = opts.hotkey ?? undefined;

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
      // One binding on any target: the action resolves the node itself and
      // no-ops on empty. Sampling deliberately reads the PRESS point rather
      // than the release — a 4px drift between the two can land on a
      // different node, and the color you meant is the one you pressed.
      bindings: [{ spec: { kind: 'click' as const, target: THROUGH_CHROME }, actionId: 'eyedropper.pick', opts: { id: 'eyedropper.click' } }],
    });
  }, [opts.keybinding, opts.hotkey, pickAction]);
}
