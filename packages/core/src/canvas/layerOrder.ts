import type { RenderLayer } from '../core/layers/render';
import type { LayerSlotValue } from './Canvas';
import { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
import type { OverlayPosition } from '../contributions/types';

const STANDARD_SLOT_SET = new Set<string>(STANDARD_SLOTS);

/**
 * Compose the final ordered layer list from a layersMap and the resolved
 * standard-slot layers.
 *
 * Semantics:
 * - Standard slots are emitted in `STANDARD_SLOTS` order.
 * - Each standard-slot layer is preceded by its `before` chain (deepest first)
 *   and followed by its `after` chain (ancestors first).
 * - `after: 'X'` / `before: 'X'` accept standard slot names OR other
 *   custom-layer keys, and chains may mix the two — a custom anchored
 *   `before` a slot can itself carry an `after` chain, and vice versa.
 * - Customs with neither `after` nor `before` go to a tail bucket emitted
 *   after all standard slots.
 * - Dangling references (target unresolvable) go to the tail with a
 *   `console.warn`. Cycles are detected and broken with a warning.
 *
 * Pure function — no side effects beyond `console.warn` on malformed input.
 */
export function composeOrderedLayers<TNode extends { id: string }, TPose>(
  layersMap: Record<string, LayerSlotValue<TNode, TPose> | null | undefined>,
  standardLayers: Partial<Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>>,
  /** When the `scene` slot is split into per-scene-layer canvas layers (keyed
   *  `scene:<layerId>`), pass them here in render order. Each key becomes an
   *  anchor point, so customs can target `before/after: 'scene:<layerId>'`.
   *  `before/after: 'scene'` still works (before the first / after the last).
   *  When omitted, the `scene` slot uses `standardLayers.scene` as before. */
  sceneLayers?: ReadonlyArray<{ key: string; layer: RenderLayer<unknown> }>,
): RenderLayer<unknown>[] {
  // Map<parent key, [{ key, layer }, ...]> — children grouped by their declared anchor.
  const afterByParent = new Map<string, Array<{ key: string; layer: RenderLayer<unknown> }>>();
  const beforeByParent = new Map<string, Array<{ key: string; layer: RenderLayer<unknown> }>>();
  const tail: Array<{ key: string; layer: RenderLayer<unknown> }> = [];
  const allCustomKeys = new Set<string>();

  for (const [key, value] of Object.entries(layersMap)) {
    if (STANDARD_SLOT_SET.has(key)) continue;
    if (!isCustomEntry(value)) continue;
    allCustomKeys.add(key);
    if (value.after) {
      const arr = afterByParent.get(value.after) ?? [];
      arr.push({ key, layer: value.layer });
      afterByParent.set(value.after, arr);
    } else if (value.before) {
      const arr = beforeByParent.get(value.before) ?? [];
      arr.push({ key, layer: value.layer });
      beforeByParent.set(value.before, arr);
    } else {
      tail.push({ key, layer: value.layer });
    }
  }

  const emitted = new Set<string>();
  const out: RenderLayer<unknown>[] = [];

  function emitChild(child: { key: string; layer: RenderLayer<unknown> }) {
    if (emitted.has(child.key)) {
      // Cycle — already emitted via another path. Warn once.
      console.warn(`composeOrderedLayers: cycle detected involving custom layer "${child.key}"`);
      return;
    }
    emitted.add(child.key);
    emitBefore(child.key);
    out.push(child.layer);
    emitAfter(child.key);
  }

  function emitAfter(parentKey: string) {
    for (const child of afterByParent.get(parentKey) ?? []) emitChild(child);
  }

  function emitBefore(parentKey: string) {
    for (const child of beforeByParent.get(parentKey) ?? []) emitChild(child);
  }

  for (const slot of STANDARD_SLOTS) {
    if (slot === 'scene' && sceneLayers) {
      // Split scene slot: emit each per-scene-layer canvas layer in order, with
      // its own anchor point. `before/after: 'scene'` brackets the whole group.
      emitBefore('scene');
      for (const sl of sceneLayers) {
        emitBefore(sl.key);
        out.push(sl.layer);
        emitAfter(sl.key);
      }
      emitAfter('scene');
      continue;
    }
    emitBefore(slot);
    const layer = standardLayers[slot];
    if (layer) out.push(layer);
    emitAfter(slot);
  }

  // Tail customs (neither after nor before).
  for (const t of tail) {
    if (emitted.has(t.key)) continue;
    emitted.add(t.key);
    out.push(t.layer);
  }

  // Orphans: customs that declared an `after`/`before` but never got emitted
  // (target didn't resolve through any chain to a known standard slot or custom).
  for (const key of allCustomKeys) {
    if (emitted.has(key)) continue;
    const value = layersMap[key];
    if (!isCustomEntry(value)) continue;
    const ref = value.after ?? value.before;
    console.warn(`composeOrderedLayers: dangling reference "${ref}" from custom layer "${key}" — falling back to tail`);
    emitted.add(key);
    out.push(value.layer);
  }

  return out;
}

/**
 * Splice a tool's positioned overlays into an already-composed layer list.
 *
 * `'top'` appends; the other two anchor on the selection-chrome layer's index
 * in `ordered`. With no selection chrome present the anchored overlays fall
 * back to the tail, keeping their relative order. Mutates and returns
 * `ordered`.
 */
export function placeToolOverlays(
  ordered: RenderLayer<unknown>[],
  selectionOverlay: RenderLayer<unknown> | undefined,
  overlays: (position: OverlayPosition) => RenderLayer<unknown>[],
): RenderLayer<unknown>[] {
  const before = overlays('before-selection');
  const after = overlays('after-selection');
  const at = selectionOverlay ? ordered.indexOf(selectionOverlay) : -1;
  if (at >= 0) {
    ordered.splice(at + 1, 0, ...after);
    ordered.splice(at, 0, ...before);
  } else {
    ordered.push(...before, ...after);
  }
  ordered.push(...overlays('top'));
  return ordered;
}
