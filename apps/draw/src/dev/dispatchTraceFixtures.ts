import type { DispatchRecord, RecordCandidate } from '@weasel-js/core/routing';

/** A dispatch record whose ranked candidates are `ranked`, the first firing.
 *  Empty `ranked` is an unhandled input that matched nothing. */
export function recordOf(o: { ts: number; eventKind: string; ranked: readonly string[] }): DispatchRecord {
  const candidates = o.ranked.map((actionId): RecordCandidate => ({
    actionId,
    routes: ['[*] drag'],
    scope: 'ambient',
    ownerToolId: null,
    namesView: false,
    specificity: [0, 0, 0, 1],
  }));
  return {
    kind: 'dispatch',
    ts: o.ts,
    input: {
      eventKind: o.eventKind,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      viewId: null,
    },
    matched: candidates,
    dropped: [],
    ranked: candidates.map((candidate, i) => ({
      candidate,
      placedBy: i === 0 ? { step: 'first' } : { step: 'order' },
      walk: i === 0 ? { kind: 'fired' } : { kind: 'not-asked' },
    })),
    predicted: false,
    fired: o.ranked[0] ?? null,
    outcome: o.ranked.length > 0 ? 'handled' : 'unhandled',
  };
}
