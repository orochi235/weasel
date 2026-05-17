import type { RenderLayer } from '../core/layers/render';
import type { LayerSlotValue } from './Canvas';
import { STANDARD_SLOTS, isCustomEntry } from './Canvas';

const STANDARD_SLOT_SET = new Set<string>(STANDARD_SLOTS);

/**
 * Compose the final ordered layer list from a layersMap and the resolved
 * standard-slot layers.
 *
 * Semantics:
 * - Standard slots are emitted in `STANDARD_SLOTS` order.
 * - Each standard-slot layer is preceded by its `before` chain (deepest first)
 *   and followed by its `after` chain (ancestors first).
 * - `after: 'X'` accepts standard slot names OR other custom-layer keys —
 *   the resolver walks the chain transitively.
 * - Customs with neither `after` nor `before` go to a tail bucket emitted
 *   after all standard slots.
 * - Dangling references (target unresolvable) go to the tail with a
 *   `console.warn`. Cycles are detected and broken with a warning.
 *
 * Pure function — no side effects beyond `console.warn` on malformed input.
 */
export function composeOrderedLayers(
  layersMap: Record<string, LayerSlotValue<any, any> | null | undefined>,
  standardLayers: Partial<Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>>,
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

  function emitAfter(parentKey: string) {
    const children = afterByParent.get(parentKey);
    if (!children) return;
    for (const child of children) {
      if (emitted.has(child.key)) {
        // Cycle — already emitted via another path. Warn once.
        console.warn(`composeOrderedLayers: cycle detected involving custom layer "${child.key}"`);
        continue;
      }
      emitted.add(child.key);
      out.push(child.layer);
      emitAfter(child.key);
    }
  }

  function emitBefore(parentKey: string) {
    const children = beforeByParent.get(parentKey);
    if (!children) return;
    for (const child of children) {
      if (emitted.has(child.key)) {
        console.warn(`composeOrderedLayers: cycle detected involving custom layer "${child.key}"`);
        continue;
      }
      emitted.add(child.key);
      emitBefore(child.key);
      out.push(child.layer);
    }
  }

  for (const slot of STANDARD_SLOTS) {
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
