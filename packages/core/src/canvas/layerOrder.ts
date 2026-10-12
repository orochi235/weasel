import type { RenderLayer } from '../core/layers/render';
import type { LayerSlotValue } from './Canvas';
import { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
import type { OverlayPosition } from '@weasel-js/routing';

const STANDARD_SLOT_SET = new Set<string>(STANDARD_SLOTS);

/**
 * Compose the final ordered layer list from a layersMap and the resolved
 * standard-slot layers.
 *
 * - Standard slots are emitted in `STANDARD_SLOTS` order.
 * - `after: 'X'` / `before: 'X'` accept standard slot names OR other
 *   custom-layer keys, and chains may mix the two.
 * - Customs with neither `after` nor `before` are emitted after all standard
 *   slots.
 * - Dangling references and cycles go to the tail with a `console.warn`.
 * - An entry with both `after` and `before` is placed by `after`.
 */
export function composeOrderedLayers<TNode extends { id: string }, TPose>(
  layersMap: Record<string, LayerSlotValue<TNode, TPose> | null | undefined>,
  standardLayers: Partial<Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>>,
  /** The `scene` slot split into per-scene-layer canvas layers (keyed
   *  `scene:<layerId>`), in render order. Each key becomes an anchor point;
   *  `before/after: 'scene'` brackets the whole group. When omitted, the
   *  `scene` slot uses `standardLayers.scene`. */
  sceneLayers?: ReadonlyArray<{ key: string; layer: RenderLayer<unknown> }>,
  /** Drawn beneath everything else, grid and customs anchored before the
   *  scene included — a fill that must never cover what is laid over it. */
  background?: RenderLayer<unknown>,
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
  const out: RenderLayer<unknown>[] = background ? [background] : [];

  function emitChild(child: { key: string; layer: RenderLayer<unknown> }) {
    // A custom has one anchor, so it is reached twice only when `sceneLayers`
    // repeats a key.
    if (emitted.has(child.key)) return;
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

  for (const t of tail) {
    if (emitted.has(t.key)) continue;
    emitted.add(t.key);
    out.push(t.layer);
  }

  const anchorOf = (key: string): string | undefined => {
    const value = layersMap[key];
    return isCustomEntry(value) ? value.after ?? value.before : undefined;
  };
  const inCycle = (key: string): boolean => {
    let at = anchorOf(key);
    for (let hops = 0; at !== undefined && hops < allCustomKeys.size; hops++) {
      if (at === key) return true;
      at = anchorOf(at);
    }
    return false;
  };

  // Orphans: customs that declared an `after`/`before` but never got emitted,
  // because the chain of anchors loops or ends on a key nothing defines.
  for (const key of allCustomKeys) {
    if (emitted.has(key)) continue;
    const value = layersMap[key];
    if (!isCustomEntry(value)) continue;
    const ref = value.after ?? value.before;
    console.warn(inCycle(key)
      ? `composeOrderedLayers: cycle detected involving custom layer "${key}" — falling back to tail`
      : `composeOrderedLayers: dangling reference "${ref}" from custom layer "${key}" — falling back to tail`);
    emitted.add(key);
    out.push(value.layer);
  }

  return out;
}

/**
 * Splice a tool's positioned overlays into an already-composed layer list.
 * With no selection chrome present the anchored overlays fall back to the
 * tail, keeping their relative order. Mutates and returns `ordered`.
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
