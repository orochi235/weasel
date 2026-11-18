import type { Keyframe } from '@weasel-js/animator';

export type Bezier = readonly [number, number, number, number];

/** A gesture in flight. The committed keys hold still underneath it. */
export type KeyframeDrag =
  | { kind: 'key'; index: number; t: number; value: number }
  | { kind: 'handle'; segment: number; bezier: readonly [number, number, number, number] };

/**
 * The state a keyframe layer owns, held by the consumer and round-tripped
 * through the layer's `onChange`.
 */
export interface KeyframeLayerState {
  /** Sorted ascending by `t`. */
  keys: readonly Keyframe<number>[];
  selectedKey: number | null;
  /** Index of the key the selected segment runs into. Its bezier handles show. */
  selectedSegment: number | null;
  drag: KeyframeDrag | null;
}

/** What {@link applyKeyframeDrag} returns: the fields of a state a drag rewrites. */
export interface KeyframeDragResult {
  keys: readonly Keyframe<number>[];
  selectedKey: number | null;
  selectedSegment: number | null;
}

/** A keyframe layer state with nothing selected and no gesture in flight. */
export function keyframeLayerState(keys: readonly Keyframe<number>[]): KeyframeLayerState {
  return { keys, selectedKey: null, selectedSegment: null, drag: null };
}

export function bezierOf(key: Keyframe<number> | undefined): Bezier | null {
  const e = key?.easing;
  return typeof e === 'object' && e !== null && 'bezier' in e ? e.bezier : null;
}

/** Where the key at `index` sits after the key at `from` moved to `to`. */
function indexAfterMove(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < index && index <= to) return index - 1;
  if (to <= index && index < from) return index + 1;
  return index;
}

/** A segment is named by the key it runs into, so it follows that key; the first key has none. */
function segmentAfterMove(segment: number | null, from: number, to: number): number | null {
  if (segment === null) return null;
  const next = indexAfterMove(segment, from, to);
  return next < 1 ? null : next;
}

/** The keys with the one at `index` moved to `t` and `value` and re-sorted, the selection following it. */
export function moveKeyTo(
  state: KeyframeLayerState, index: number, t: number, value: number,
): KeyframeDragResult & { selectedKey: number } {
  const moved = { ...state.keys[index], t, value };
  const rest = state.keys.filter((_, i) => i !== index);
  const at = rest.findIndex((k) => k.t > t);
  const selectedKey = at === -1 ? rest.length : at;
  rest.splice(selectedKey, 0, moved);
  return { keys: rest, selectedKey, selectedSegment: segmentAfterMove(state.selectedSegment, index, selectedKey) };
}

/**
 * The keys a state's drag would leave behind: a dragged key re-sorted into place, or a dragged handle's control
 * points written onto the key its segment runs into. `selectedKey` follows a moved key to its new index, and
 * `selectedSegment` follows the key it runs into; a key or handle dropped where it started returns the same `keys`.
 */
export function applyKeyframeDrag(state: KeyframeLayerState): KeyframeDragResult {
  const { drag, keys, selectedSegment } = state;
  const unchanged = { keys, selectedKey: state.selectedKey, selectedSegment };
  if (!drag) return unchanged;
  if (drag.kind === 'key') {
    const k = keys[drag.index];
    if (k && k.t === drag.t && k.value === drag.value) return { ...unchanged, selectedKey: drag.index };
    return moveKeyTo(state, drag.index, drag.t, drag.value);
  }
  if (bezierOf(keys[drag.segment])?.every((v, i) => v === drag.bezier[i])) return unchanged;
  const next = keys.slice();
  next[drag.segment] = { ...keys[drag.segment], easing: { bezier: drag.bezier } };
  return { ...unchanged, keys: next };
}

/** The bezier of the selected segment, live under a handle drag; null with no selected segment or no bezier easing. */
export function activeBezier(state: KeyframeLayerState): Bezier | null {
  const seg = state.selectedSegment;
  if (seg === null || seg < 1 || seg >= state.keys.length) return null;
  const d = state.drag;
  if (d?.kind === 'handle' && d.segment === seg) return d.bezier;
  return bezierOf(state.keys[seg]);
}
