import { useMemo, useRef, createElement } from 'react';
import { defineTool, claim, none } from '../routing';
import type { ActionFn } from '../routing';
import type { Tool, HotkeyTrigger } from '../types';
import type { KeyBinding } from 'interactions/actions/useKeybinding';
import { EyedropperIcon } from '../../icons';

export interface UseEyedropperToolOptions {
  /** Called when the user picks a color. `null` means "no node was hit
   *  with a color" — currently only reachable when `colorOf` returns null
   *  on a real hit; empty-click is a no-op in v1. */
  onPick: (color: string | null) => void;

  /** Map a node id to a color string, or `null` if the node has no color
   *  to sample. Called on click with `ctx.target.id`. */
  colorOf: (id: string) => string | null;

  /** Override the default `{ key: 'I' }` keybinding. Pass `null` to omit
   *  the keybinding entirely (palette-only or hotkey-only wiring). */
  keybinding?: KeyBinding | null;

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
 */
export function useEyedropperTool(opts: UseEyedropperToolOptions): Tool<null> {
  const onPickRef = useRef(opts.onPick);
  onPickRef.current = opts.onPick;
  const colorOfRef = useRef(opts.colorOf);
  colorOfRef.current = opts.colorOf;

  return useMemo(() => {
    const pickFromNode: ActionFn<null> = (ctx) => {
      if (ctx.target?.category !== 'node') return none();
      const color = colorOfRef.current(ctx.target.id);
      onPickRef.current(color);
      return claim();
    };

    const onEmptyClick: ActionFn<null> = () => none();

    // Claim at pointerdown so a higher-priority slot pre-empts any
    // active-slot tool whose own `pointer.onDown` always claims (notably
    // useSelectTool). Without this, holding Alt to hotkey-engage the
    // eyedropper still routes the gesture to the active tool, and the
    // eyedropper's `pointer.onClick` never fires. The sampling itself
    // still happens in the `click` route — pointerdown is just a gate.
    const claimAtDown: ActionFn<null> = () => claim();

    // Resolve overrides. The spec says `null` => omit; defineTool reads
    // these directly into the returned Tool, and the registry treats
    // `undefined` as "no trigger." Convert null → undefined here.
    const keybinding =
      opts.keybinding === null ? undefined : (opts.keybinding ?? { key: 'I' });
    const hotkey =
      opts.hotkey === null ? undefined : (opts.hotkey ?? 'alt');

    return defineTool<null>({
      id: 'eyedropper',
      keybinding,
      hotkey,
      cursor: 'crosshair',
      presentation: {
        label: 'Eyedropper',
        icon: createElement(EyedropperIcon),
        group: 'view',
      },
      initial: {
        // Claim on every pointerdown so a higher-priority slot
        // pre-empts the active tool. '*' now catches empty hits via
        // the wildcard fall-through, so a single entry suffices.
        pointerDown: {
          '*': claimAtDown,
        },
        click: {
          '*':   pickFromNode,
          empty: onEmptyClick,
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.keybinding, opts.hotkey]);
}
