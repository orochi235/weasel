import type { LoupePoint } from '@weasel-js/labkit/loupe';

/** The trial under a client point: its host, and the point in the host's own px. */
export interface TrialHit {
  trialId: string;
  host: HTMLElement;
  /** In the host's own px: the client offset from its corner, undone by any zoom on the pane holding it. */
  local: LoupePoint;
  /** Client px per host px. */
  scale: number;
}

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
    const rect = host.getBoundingClientRect();
    const scale = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
    return {
      trialId: host.dataset.fgHost ?? '',
      host,
      local: { x: (client.x - rect.left) / scale, y: (client.y - rect.top) / scale },
      scale,
    };
  }
  return null;
}
