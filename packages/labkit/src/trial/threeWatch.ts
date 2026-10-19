import { isDev } from '@weasel-js/react';

type Hook = EventTarget;
type Global = { __THREE_DEVTOOLS__?: Hook };

const byTrial = new Map<string, Set<() => void>>();
let installed = false;

/** How long a renderer's canvas has to join the DOM, for one created by three
 *  and appended after the constructor returns. */
const RETRIES_MS = [0, 50, 250, 1000];

function findTrial(canvas: Element, attempt = 0): void {
  if (!canvas.isConnected) {
    const wait = RETRIES_MS[attempt + 1];
    if (wait !== undefined) setTimeout(() => findTrial(canvas, attempt + 1), wait);
    return;
  }
  const id = canvas.closest('[data-trial-id]')?.getAttribute('data-trial-id');
  if (!id) return;
  for (const found of byTrial.get(id) ?? []) found();
}

/**
 * Listens for three.js renderers, in development. A `WebGLRenderer` announces
 * itself on `__THREE_DEVTOOLS__` when the page defines it, which is how the
 * three.js devtools find one; labkit defines it if nothing has, and joins it
 * if something has. Call it before any renderer is constructed — during a
 * trial's render, ahead of its instrument's effects.
 */
export function installThreeWatch(): void {
  if (installed || !isDev() || typeof EventTarget === 'undefined') return;
  installed = true;
  const g = globalThis as Global;
  g.__THREE_DEVTOOLS__ ??= new EventTarget();
  g.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
    const el = (event as CustomEvent<{ domElement?: unknown }>).detail?.domElement;
    // Duck-typed: the canvas may come from another realm than this module.
    if (typeof (el as Element | undefined)?.closest === 'function') {
      setTimeout(() => findTrial(el as Element), RETRIES_MS[0]);
    }
  });
}

/** Calls `found` whenever a three.js renderer draws into trial `trialId`'s DOM. */
export function watchThree(trialId: string, found: () => void): () => void {
  const set = byTrial.get(trialId) ?? new Set();
  byTrial.set(trialId, set);
  set.add(found);
  return () => {
    set.delete(found);
    if (set.size === 0) byTrial.delete(trialId);
  };
}
