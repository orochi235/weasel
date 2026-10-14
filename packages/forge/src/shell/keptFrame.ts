import { useLatest } from '@weasel-js/core';
import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';
import { canMoveFrames, moveFrame } from './framePool';

/** What of a frame's handshake decides whether the frame is worth handing on. */
export interface KeptLink {
  awaiting: string | null;
  sent: object | null;
}

interface Kept {
  frame: HTMLIFrameElement;
  link: KeptLink;
}

const kept = new Map<string, Kept>();
let shelf: HTMLDivElement | null = null;

/** Where a kept frame waits, inside the document so it stays loaded. */
function shelfElement(): HTMLDivElement {
  if (!shelf) {
    shelf = document.createElement('div');
    shelf.className = 'fg-frame-pool';
    shelf.setAttribute('aria-hidden', 'true');
  }
  if (!shelf.isConnected) document.body.append(shelf);
  return shelf;
}

export interface KeptFrameOptions<L extends KeptLink> {
  /** Names the story and the trial showing it; null where there is no trial to hand a frame on within. */
  key: string | null;
  slot: RefObject<Element | null>;
  frame: RefObject<HTMLIFrameElement | null>;
  link: RefObject<L | null>;
  /** Called with the link of a frame taken over from the view before this one. */
  onAdopt: (link: L) => void;
  /** Closes the link of a frame no view took. */
  onDrop: () => void;
}

/** Takes over the frame the view before this one shelved under the same key, if it left one. */
function adopt<L extends KeptLink>({ key, slot, frame, link, onAdopt }: KeptFrameOptions<L>): void {
  const waiting = key === null ? undefined : kept.get(key);
  if (key === null || !waiting || !slot.current) return;
  kept.delete(key);
  moveFrame(slot.current, waiting.frame);
  frame.current = waiting.frame;
  link.current = waiting.link as L;
  onAdopt(waiting.link as L);
}

/**
 * Shelves the view's frame for the view mounting in its place; true when there was a frame worth shelving. Takes
 * the holder of the options and reads it when called, as the view unmounts: the options are then those of the
 * view's last commit, not of its mount.
 */
function shelve<L extends KeptLink>(options: { readonly current: KeptFrameOptions<L> }): boolean {
  const { key, frame, link, onDrop } = options.current;
  const element = frame.current;
  const current = link.current;
  if (key === null || !element?.isConnected || !current || !canMoveFrames()) return false;
  if (current.awaiting === null && current.sent === null) return false;
  const entry: Kept = { frame: element, link: current };
  moveFrame(shelfElement(), element);
  kept.set(key, entry);
  // The view taking over mounts in this commit, so a frame still here after it has no taker.
  queueMicrotask(() => {
    if (kept.get(key) !== entry) return;
    kept.delete(key);
    onDrop();
    element.remove();
  });
  return true;
}

/**
 * Hands a story's loaded frame from a view that unmounts to the one mounting in its place in the same commit, as a
 * trial does when its instrument gains a stage. Returns a function that answers, when called, whether this view's
 * frame has been handed on and is no longer its own to remove; an effect cleanup calls it, since the hand-off
 * happens as the view unmounts. Nothing is handed on where the browser cannot move an iframe without reloading it,
 * or before the frame's `ready`.
 */
export function useKeptFrame<L extends KeptLink>(options: KeptFrameOptions<L>): () => boolean {
  const handedOn = useRef(false);
  const latest = useLatest(options);
  // A layout effect on both sides: its cleanup runs before React takes the old view's elements out of the
  // document, which is the last moment the frame can move without reloading.
  useLayoutEffect(() => {
    adopt(latest.current);
    return () => {
      if (shelve(latest)) handedOn.current = true;
    };
  }, [latest]);
  return useCallback(() => handedOn.current, []);
}
