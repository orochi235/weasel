import type { BindingScope } from './matcher';

/**
 * How one input was resolved: every binding that matched it, what each filter
 * dropped, the order the rest were ranked in and why, and what the walk down
 * that order did. The dispatcher fills one per input in dev builds, and
 * `Dispatcher.explain` fills one on request without invoking anything.
 *
 * Plain data — no functions, no live objects — so it can be kept in a trace
 * buffer, serialized, or built by hand as a fixture.
 */
export interface DispatchRecord {
  kind: 'dispatch';
  ts: number;
  input: DispatchRecordInput;
  /** Every binding whose spec matched the input, in matcher order, including
   *  those a filter then dropped. */
  matched: readonly RecordCandidate[];
  dropped: readonly DroppedCandidate[];
  /** The candidates that survived both filters, best first. */
  ranked: readonly RankedCandidate[];
  /** True when nothing was invoked: the record answers "what would happen". */
  predicted: boolean;
  /** Action id of the candidate that fired (or would), else `null`. */
  fired: string | null;
  outcome: 'handled' | 'unhandled';
}

/** The input a {@link DispatchRecord} describes, reduced to plain data. */
export interface DispatchRecordInput {
  /** `InputEvent.kind`: `'key'`, `'pointerdown'`, `'wheel'`, … */
  eventKind: string;
  /** For `key` / `key-held` events, the key id (`'Escape'`, `' '`, `'a'`). */
  key?: string;
  modifiers: { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
  /** The view the input was routed to; `null` for the surface's own camera. */
  viewId: string | null;
  /** World point, for events that carry one. */
  world?: { x: number; y: number };
  /** Active mode id, when the host supplies a rule context. */
  mode?: string;
}

/** One matched binding. */
export interface RecordCandidate {
  actionId: string;
  /** The binding's spec in route grammar — one per arg alternative. */
  routes: readonly string[];
  scope: BindingScope;
  /** The tool or contribution that declared the binding; `null` for an action's own binding. */
  ownerId: string | null;
  /** Whether the binding's `views` names the routed view. */
  namesView: boolean;
  /** `specificity(spec)`: target, modifiers, phase, exact. */
  specificity: readonly [number, number, number, number];
  /** The action's `eligible` rule as text, when it declares one. */
  eligible?: string;
}

/** A matched candidate a filter removed before ranking, and which filter. */
export type DroppedCandidate =
  /** An exclusive claim on the input barred bindings that do not read the
   *  claim's affordance. */
  | { candidate: RecordCandidate; filter: 'claim'; owner?: string }
  /** The action's `eligible` rule does not hold. */
  | { candidate: RecordCandidate; filter: 'ineligible'; rule: string };

/** One field of the `specificity` tuple, in the order it is compared. */
export type SpecificityPart = 'target' | 'mods' | 'phase' | 'exact';

/** The ranking step that put a candidate below the one before it. */
export type PlacedBy =
  | { step: 'first' }
  /** The one above names the routed view; this one does not. */
  | { step: 'view' }
  /** The one above sits in a higher scope tier. */
  | { step: 'tier' }
  /** Same tier; the one above is more specific in `part`. */
  | { step: 'specificity'; part: SpecificityPart }
  /** Tied; the one above is gated by an `eligible` rule that holds. */
  | { step: 'context' }
  /** Tied on everything; registration order. */
  | { step: 'order' };

/** What the walk did with one ranked candidate. */
export type WalkStep =
  | { kind: 'fired' }
  /** Predicted records only: this candidate would fire. Nothing was started,
   *  so an ongoing action here may still bail at `start()` for real. */
  | { kind: 'would-fire' }
  /** `enabled()` returned this reason. */
  | { kind: 'declined'; reason: string }
  /** An ongoing action's `start()` returned an empty handle. */
  | { kind: 'empty-handle' }
  /** An ongoing action bound to a press-time `pointerDown` spec; refused. */
  | { kind: 'misbound' }
  /** Its action was already tried higher up; each runs at most once. */
  | { kind: 'duplicate' }
  | { kind: 'no-such-action' }
  /** Below the winner; never asked. */
  | { kind: 'not-asked' }
  /** Below the winner, asked anyway (`evaluateShadowed`), and it passed. */
  | { kind: 'outranked' };

/** A candidate that survived the filters: why it sits where it does, and
 *  what the walk did with it. */
export interface RankedCandidate {
  candidate: RecordCandidate;
  placedBy: PlacedBy;
  walk: WalkStep;
}
