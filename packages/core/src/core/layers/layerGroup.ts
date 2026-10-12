import type { BlendFactors, CompositeOp, DrawCommand, Effect } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import type { Dims } from './render';

/**
 * Several consecutive layers composited as one.
 *
 * A layer's own `effects` run over that layer alone, which is the wrong
 * picture whenever a pass reads neighboring pixels: `blur(A over B)` is not
 * `blur(A) over blur(B)`, and it costs a buffer and a pass chain per layer. A
 * group draws its members into one buffer, runs one chain over it, and
 * composites the result back once.
 *
 * Membership is by `RenderLayer.id` — the same names `layerOrder` and
 * `layerVisibility` use, not the `layers` map's slot keys.
 *
 * Only *consecutive* members share a buffer, because anything drawn between
 * two members has to land between them. A group whose members are separated in
 * the render order is drawn as one bracket per run, with a warning: the
 * picture is right, the declaration almost certainly is not.
 *
 * This is a render-stack bracket, not a scene `ContainerNode` — it holds no
 * ids, survives no reload, and nothing in the scene knows about it.
 */
export interface LayerGroup {
  /** Names the group in warnings; not a layer id and never drawn. */
  id: string;
  /**
   * Member layer ids. Order here is ignored — the render order decides.
   *
   * A name claims that layer and every layer under it in the `:` namespace, so
   * `'scene'` covers the `scene:<layerId>` layers a scene with declared layers
   * draws as — the same set `before`/`after: 'scene'` anchors against. The
   * separator is required: `'scene'` does not reach `scenery`. A name matching
   * no layer being drawn is warned about rather than ignored.
   */
  layers: readonly string[];
  /**
   * Passes over the group's combined pixels, in order. A thunk is re-read on
   * every frame, so an animating radius costs no React render; an array is
   * read once per frame either way.
   */
  effects?: readonly Effect[] | ((view: View, dims: Dims) => readonly Effect[]);
  /** Opacity applied to the group's composited result, not to each member. */
  alpha?: number;
  /** 4×5 color matrix (row-major, 20 numbers) applied to the composited
   *  result. See `GroupDrawCommand.colorMatrix`. */
  colorMatrix?: number[];
  /** How the composited result joins the layers under it. Default
   *  `source-over`. See `GroupDrawCommand.composite`. */
  composite?: CompositeOp | BlendFactors;
}

/**
 * Layer id → the group that owns it.
 *
 * A member name claims the layer of that exact id and every layer under it in
 * the `:` namespace, so `'scene'` claims the whole split scene slot. First
 * claim wins across groups, so a second one is a declaration bug rather than a
 * silent reassignment; the same group naming a layer twice — `['scene',
 * 'scene:tiles']` — is redundant, not a conflict, and passes quietly.
 */
export function groupMembership(
  groups: readonly LayerGroup[] | undefined,
  layerIds: Iterable<string>,
): Map<string, LayerGroup> | null {
  if (!groups || groups.length === 0) return null;
  const stack = [...layerIds];
  const byLayer = new Map<string, LayerGroup>();
  for (const group of groups) {
    for (const name of group.layers) {
      let matched = false;
      for (const id of stack) {
        if (id !== name && !id.startsWith(`${name}:`)) continue;
        matched = true;
        const claimed = byLayer.get(id);
        if (claimed === group) continue;
        if (claimed) {
          console.warn(
            `[weasel] layer "${id}" is claimed by layer groups "${claimed.id}" and ` +
            `"${group.id}"; it stays in "${claimed.id}".`,
          );
          continue;
        }
        byLayer.set(id, group);
      }
      if (!matched) {
        console.warn(
          `[weasel] layer group "${group.id}" names "${name}", which matches no layer ` +
          'being drawn, so it groups nothing. Check the id against the layer stack — a ' +
          'scene with declared layers draws as "scene:<layerId>", which "scene" covers.',
        );
      }
    }
  }
  return byLayer;
}

/**
 * Put one run of a group's commands under its shared compositing.
 *
 * No transform: every member already carries its own space wrap, so a second
 * one here would apply the view twice to world layers and once to screen ones.
 * A group that composites plainly gets no wrapper at all — an extra group
 * command that changes nothing is still a push and a pop per frame.
 */
export function wrapGroup(
  group: LayerGroup,
  children: DrawCommand[],
  view: View,
  dims: Dims,
): DrawCommand[] {
  const declared = typeof group.effects === 'function'
    ? group.effects(view, dims)
    : group.effects;
  const effects = declared && declared.length > 0 ? declared : undefined;
  if (!effects && group.alpha === undefined && group.colorMatrix === undefined
      && group.composite === undefined) return children;
  const fades = group.alpha !== undefined && group.alpha < 1;
  return [{
    kind: 'group',
    ...(effects ? { effects } : {}),
    ...(!effects && (fades || group.colorMatrix !== undefined) ? { isolate: true } : {}),
    ...(group.alpha !== undefined ? { alpha: group.alpha } : {}),
    ...(group.colorMatrix !== undefined ? { colorMatrix: group.colorMatrix } : {}),
    ...(group.composite !== undefined ? { composite: group.composite } : {}),
    children,
  }];
}
