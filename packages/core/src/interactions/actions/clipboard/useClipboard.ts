import { useCallback, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { WorldPoint } from '@weasel-js/routing';
import { usePointerContext } from '@weasel-js/routing/react';
import { dwarn } from 'debug/flag';
import type { ClipboardDep } from '../editDeps';
import { defaultFlavors, writeOsClipboard, type ClipboardFlavors } from './osClipboard';

type Replacer = (key: string, value: unknown) => unknown;

/** What a paste wrote: the new nodes' ids, and the copies the next paste of this clipboard starts from. */
export interface PastedItems<TItem> {
  ids: string[];
  /** Shaped like what `copy` returns. Pasting again pastes these, so a run of pastes steps on from the last one
   *  instead of stacking on the first. */
  items: readonly TItem[];
}

/** Options for `useClipboard`. */
export interface UseClipboardOptions<TItem> {
  /** The ids Copy takes. */
  getSelection: () => readonly string[];
  /** The copyable form of `ids`, or `null` when they cannot be copied. */
  copy: (ids: readonly string[]) => readonly TItem[] | null;
  /** Write copies of `items` into the document, and say what was written, or `null` when nothing was.
   *  `at.dropPoint` is where the paste was asked to land, when it was. */
  paste: (items: readonly TItem[], at: { dropPoint?: WorldPoint }) => PastedItems<TItem> | null;
  /** Called after a paste with the new ids. */
  onPaste?: (ids: string[]) => void;
  /** Where a paste with no point of its own lands. Defaults to the pointer, as `<SceneCanvas>` publishes it. */
  getDropPoint?: () => WorldPoint | null;
  /** The OS-clipboard flavors for a copy, by MIME type. Defaults to the kit's JSON flavor and `text/plain`
   *  carrying the same JSON; `{}` writes nothing to the OS clipboard. A value may be a promise. Runs inside
   *  `copy()`, so it reads the document as it stood at the copy. */
  produceFlavors?: (copied: { items: readonly TItem[] }) => ClipboardFlavors;
  /** Replacer for the default JSON flavor. Ignored when `produceFlavors` is given. */
  jsonReplacer?: Replacer;
}

/**
 * Copy and paste over any document: an in-memory clipboard of what `copy` returns, written to the OS clipboard as
 * well, and pasted through `paste`. The returned object is the `clipboard` dep's shape. `useClipboardOps` is this
 * over an `InsertAdapter` and the scene's op history; an app whose own document owns its nodes passes its own
 * functions, or uses `@weasel-js/editor`'s `useDocClipboard`, which adds the commands.
 */
export function useClipboard<TItem>(options: UseClipboardOptions<TItem>): ClipboardDep {
  const pointerCtx = usePointerContext();
  const opts = useLatest({
    ...options,
    getDropPoint: options.getDropPoint ?? (pointerCtx ? () => pointerCtx.get()?.world ?? null : undefined),
  });
  const held = useRef<readonly TItem[]>([]);

  const copy = useCallback(() => {
    const o = opts.current;
    const ids = o.getSelection();
    if (ids.length === 0) return;
    const items = o.copy(ids);
    if (!items || items.length === 0) return;
    held.current = items;
    // The in-memory copy is already made; a producer that throws, or a browser with no clipboard API, costs only
    // the OS write.
    let flavors: ClipboardFlavors | null = null;
    try {
      flavors = o.produceFlavors?.({ items }) ?? defaultFlavors(items, o.jsonReplacer);
    } catch (err) {
      dwarn('clipboard', `flavor producer threw — skipping OS write: ${String(err)}`);
    }
    if (flavors) void writeOsClipboard(flavors);
  }, [opts]);

  const paste = useCallback((at?: WorldPoint) => {
    const items = held.current;
    if (items.length === 0) return;
    const o = opts.current;
    const dropPoint = at ?? o.getDropPoint?.() ?? undefined;
    const pasted = o.paste(items, dropPoint ? { dropPoint } : {});
    if (!pasted || pasted.ids.length === 0) return;
    if (pasted.items.length > 0) held.current = pasted.items;
    o.onPaste?.(pasted.ids);
  }, [opts]);

  const isEmpty = useCallback(() => held.current.length === 0, []);
  return useMemo(() => ({ copy, paste, isEmpty }), [copy, paste, isEmpty]);
}
