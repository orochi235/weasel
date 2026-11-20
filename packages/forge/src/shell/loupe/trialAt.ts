import { layoutBoxOf } from '@weasel-js/core';
import type { LoupePoint } from '@weasel-js/labkit/loupe';

/** The trial under a client point: its host, and the point in the host's own px. */
export interface TrialHit {
  trialId: string;
  host: HTMLElement;
  /** In the host's own px: the client offset from its corner, undone by any zoom on the pane holding it. */
  local: LoupePoint;
  /** Client px per host px. */
  scale: number;
  /** The host's own layout size, in host px: what a copy of it lays out at. */
  width: number;
  height: number;
}

/** The element an in-document story scrolls in, inside its host; null for a host with none, as a frame's. */
export const scrollerOf = (host: HTMLElement | null): HTMLElement | null =>
  host?.querySelector<HTMLElement>(':scope > .fg-story__scroll') ?? null;

const stackAt = (client: LoupePoint, doc: Document): readonly Element[] =>
  doc.elementsFromPoint?.(client.x, client.y) ?? [];

/**
 * The topmost story host under `client`, an in-document story's or an isolated one's frame host, skipping a lens's
 * copies, which only ever show some host beneath them.
 */
export function trialAt(client: LoupePoint, doc: Document = document): TrialHit | null {
  for (const el of stackAt(client, doc)) {
    const host = el.closest<HTMLElement>('[data-fg-host]');
    if (!host || host.hasAttribute('data-fg-copy')) continue;
    const { left, top, scale } = layoutBoxOf(host);
    return {
      trialId: host.dataset.fgHost ?? '',
      host,
      local: { x: (client.x - left) / scale.x, y: (client.y - top) / scale.y },
      scale: scale.x,
      width: host.offsetWidth,
      height: host.offsetHeight,
    };
  }
  return null;
}

/** Calls `notify` whenever the host it is pointed at changes size, as a pane resized without the window does; pointing
 *  it at null stops it. */
export function createSizeWatcher(notify: () => void): (host: HTMLElement | null) => void {
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => notify());
  let watched: HTMLElement | null = null;
  return (host) => {
    if (host === watched) return;
    if (watched) observer?.unobserve(watched);
    watched = host;
    if (host) observer?.observe(host);
  };
}
