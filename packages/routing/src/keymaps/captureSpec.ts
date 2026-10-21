import type {
  ClickSpec, ContextMenuSpec, DoubleClickSpec, DragSpec, EventModifiers, KeyHeldSpec, KeySpec, ModSpec,
} from '@weasel-js/gestures';

/** A spec kind a binding editor can capture. */
export type CaptureKind = 'key' | 'key-held' | 'click' | 'doubleClick' | 'drag' | 'contextMenu';

/** What `captureGesture` resolves to. */
export type CapturedSpec = KeySpec | KeyHeldSpec | ClickSpec | DoubleClickSpec | DragSpec | ContextMenuSpec;

/** An event's modifiers as a spec's, with the platform's primary one as `mod`. */
function modSpecOf(e: EventModifiers, apple: boolean): ModSpec | undefined {
  const mods: ModSpec = {};
  if (apple ? e.metaKey : e.ctrlKey) mods.mod = true;
  if (e.shiftKey) mods.shift = true;
  if (e.altKey) mods.alt = true;
  if (apple ? e.ctrlKey : e.metaKey) mods[apple ? 'ctrl' : 'meta'] = true;
  return Object.keys(mods).length > 0 ? mods : undefined;
}

export function specOf<K extends CapturedSpec['kind']>(kind: K, e: EventModifiers, apple: boolean): { kind: K; mods?: ModSpec } {
  const mods = modSpecOf(e, apple);
  return mods ? { kind, mods } : { kind };
}

/** Keep an event from the page. */
export const take = (e: Event): void => { e.preventDefault(); e.stopPropagation(); };
