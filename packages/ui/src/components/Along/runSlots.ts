import { useContext, useLayoutEffect, useState, useSyncExternalStore, type Context, type CSSProperties, type RefObject } from 'react';
import type { RunAlign, TrackRun } from '@weasel-js/geom';
import { insideOf } from './runBend';
import { useItemLengths, type RunItemsOf, type RunKeyOf } from './useItemLengths';
import { useRunRow, type RunItemPlace, type RunOverflow, type RunRow } from './useRunRow';

/** The attribute a slot's element carries its key in, and a host's root carries to mark where its slots end. */
export const RUN_SLOT = 'data-run-slot';
export const RUN_HOST = 'data-run-host';

/** What a part spreads on its element to take its place on a run: its key always, its place once laid out. */
export interface RunSlotProps {
  [RUN_SLOT]: string;
  className?: string;
  style?: CSSProperties;
  'data-clipped'?: RunItemPlace['clipped'];
  /** Px along the run to the part's center. */
  'data-run-at'?: number;
  /** Which of the part's own sides, as drawn, faces the inside of the run's bend. */
  'data-inside'?: 'top' | 'bottom';
}

/**
 * Places handed by key from a host that lays parts along a run to the parts themselves, which it does not render: a
 * tab list's tabs, a radio group's radios. Without a host publishing, every part reads `undefined` and draws as it
 * would off a run.
 */
export interface RunSlots {
  /** Whether a component above the one that made the channel hosts its slots, so a part that would host them joins. */
  readonly held: boolean;
  subscribe(listener: () => void): () => void;
  /** The places published, or null while nothing hosts. */
  current(): ReadonlyMap<string, RunSlotProps> | null;
  publish(places: ReadonlyMap<string, RunSlotProps> | null): void;
}

/** A channel for {@link RunSlots}; `held` when the component making it hosts the slots itself. */
export function createRunSlots(held = false): RunSlots {
  let places: ReadonlyMap<string, RunSlotProps> | null = null;
  let signature = 'null';
  const listeners = new Set<() => void>();
  return {
    held,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    current: () => places,
    publish(next) {
      const sig = next === null ? 'null' : JSON.stringify([...next]);
      if (sig === signature) return;
      signature = sig;
      places = next;
      for (const listener of listeners) listener();
    },
  };
}

const NO_SLOTS = { subscribe: () => () => {}, current: () => null };

/**
 * The props a part keyed `key` spreads to take its place on the run its family's channel hosts, or undefined off one.
 * Each family of parts reads its own context, so a radio inside a tab's panel never takes a tab's place.
 */
export function useRunSlot(context: Context<RunSlots | null>, key: string | undefined): RunSlotProps | undefined {
  const slots = useContext(context) ?? NO_SLOTS;
  return slotOf(useSyncExternalStore(slots.subscribe, slots.current, slots.current), key);
}

/** The props for `key` among `places` as a channel publishes them; a host reads its own parts' with it. */
export function slotOf(places: ReadonlyMap<string, RunSlotProps> | null, key: string | undefined): RunSlotProps | undefined {
  if (places === null || key === undefined) return undefined;
  return places.get(key) ?? { [RUN_SLOT]: key };
}

/** `className` and `slot`'s class joined, for a part merging its own class with its place. */
export function slotClass(slot: RunSlotProps | undefined, className: string | undefined): string | undefined {
  return [className, slot?.className].filter(Boolean).join(' ') || undefined;
}

const keyOf: RunKeyOf = (el) => el.getAttribute(RUN_SLOT);

/** The slots under `root` in document order that no nearer host holds. */
export const slotItems: RunItemsOf = (root) =>
  Array.from(root.querySelectorAll(`[${RUN_SLOT}]`)).filter((el) => el.parentElement?.closest(`[${RUN_HOST}]`) === root);

/** What {@link useRunSlotHost} reads. */
export interface RunSlotHostArgs {
  slots: RunSlots;
  /** The host's root, which carries {@link RUN_HOST} and the row's `rootProps`. */
  root: RefObject<HTMLElement | null>;
  run: TrackRun;
  gap: number;
  align: RunAlign;
  overflow?: RunOverflow;
}

/** A run row of slots, as {@link useRunSlotHost} lays them. */
export interface RunSlotHost extends RunRow {
  /** The slots found, in run order. */
  keys: readonly string[];
  /** The tallest slot's height, px: how thick the row stands across the run. */
  thickness: number;
  /** A slot's place, or undefined for a key not on the run. */
  placeOf(key: string): RunItemPlace | undefined;
  /** A slot's length along the run, px; 0 for a key not on it. */
  lengthOf(key: string): number;
}

/**
 * Lays the slots under `root` along `run` in document order and publishes each one's place on `slots` by its key, for
 * the parts reading them with {@link useRunSlot}. Read again after every commit, so a part added, removed or reordered
 * takes its place.
 */
export function useRunSlotHost({ slots, root, run, gap, align, overflow }: RunSlotHostArgs): RunSlotHost {
  const [seen, setSeen] = useState<Seen>({ keys: [], thickness: 0 });
  useLayoutEffect(() => {
    const look = (): void => setSeen((prev) => seenUnder(root.current, prev));
    look();
  });
  // Re-rendered with the parts it publishes to, so it reads them again once they carry their keys.
  useSyncExternalStore(slots.subscribe, slots.current, slots.current);
  // A part that renders elsewhere, as React Aria renders a tab, may take its key in a commit of its own.
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null || typeof MutationObserver === 'undefined') return;
    const watch = new MutationObserver(() => setSeen((prev) => seenUnder(root.current, prev)));
    watch.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: [RUN_SLOT] });
    return () => watch.disconnect();
  }, [root]);
  const lengths = useItemLengths(root, seen.keys, keyOf, slotItems);
  const row = useRunRow({ root, keyOf, itemsOf: slotItems, run, lengths: seen.keys.map((key) => lengths.get(key) ?? 0), gap, align, overflow });
  const index = new Map(seen.keys.map((key, i) => [key, i]));
  const placeOf = (key: string): RunItemPlace | undefined => {
    const i = index.get(key);
    return i === undefined ? undefined : row.place(i);
  };

  const places = new Map<string, RunSlotProps>();
  for (const key of seen.keys) {
    const at = placeOf(key)!;
    places.set(key, { [RUN_SLOT]: key, className: at.className, style: at.style, 'data-clipped': at.clipped, 'data-run-at': at.at * run.length, 'data-inside': insideOf(run, at.at) });
  }
  useLayoutEffect(() => slots.publish(places));
  useLayoutEffect(() => () => slots.publish(null), [slots]);
  return { ...row, keys: seen.keys, thickness: seen.thickness, placeOf, lengthOf: (key) => (index.has(key) ? (lengths.get(key) ?? 0) : 0) };
}

interface Seen {
  keys: readonly string[];
  thickness: number;
}

/** The slots under `el` and the tallest one's height, or `prev` itself when neither has changed. */
function seenUnder(el: HTMLElement | null, prev: Seen): Seen {
  if (el === null) return prev;
  const items = slotItems(el) as HTMLElement[];
  const keys = items.map((item) => keyOf(item)!);
  const thickness = Math.max(0, ...items.map((item) => item.offsetHeight));
  return prev.thickness === thickness && prev.keys.join('\n') === keys.join('\n') ? prev : { keys, thickness };
}
