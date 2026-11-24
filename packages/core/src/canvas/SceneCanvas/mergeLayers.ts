import type { DrawCommand } from '@weasel-js/renderer';
import { targetSizesPx, type TargetSizesPx } from '../../core/device/targets';
import type { Node } from 'core/scene/types';
import { defaultDrawOne, defaultPaintBounds, paintBoundsFor } from '../defaultDrawOne';
import { isCustomEntry, type CustomLayerEntry, type LayersMap } from '../layerSlots';
import type { SceneCanvasLayers } from './props';

/** `<SceneCanvas layers>` laid over the enabled presets' layers: a slot the
 *  consumer names, `null` included, is theirs, and the rest, one given as `undefined` among them, are the presets'. */
export function layersOverPresets<L extends object>(
  presetLayers: Readonly<Record<string, CustomLayerEntry>>,
  user: L | undefined,
): L | undefined {
  if (Object.keys(presetLayers).length === 0) return user;
  return { ...presetLayers, ...givenFields(user ?? {}) } as L;
}

/** `config` without its keys set to `undefined`: a field given as `undefined` is one left out. */
function givenFields<C extends object>(config: C): Partial<C> {
  return Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined)) as Partial<C>;
}

/** Deep-merge user-supplied `layers` with kit defaults. Slots the user
 *  doesn't mention get filled with defaults; slots explicitly set to
 *  `null` are dropped. Partial slot configs are shallow-spread on top of the
 *  default slot config, a field set to `undefined` counting as left out. `targetScale` (from the {@link DeviceProfile}) and `baseSizes` go to `targetSizesPx`. */
export function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: SceneCanvasLayers<Node<TData, TLayer, TPose>, TPose> | undefined,
  targetScale = 1, baseSizes: Partial<TargetSizesPx> = {},
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  const defaults = {
    scene: {
      drawOne: defaultDrawOne as (
        node: Node<TData, TLayer, TPose>,
        pose: TPose,
      ) => DrawCommand[],
      paintBounds: defaultPaintBounds<TData, TLayer, TPose>,
    },
    selectionOverlay: { handles: { size: targetSizesPx(targetScale, baseSizes).handle } },
  };

  if (!user) return defaults as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  // Start from a shallow copy of the user map so unknown slots pass through.
  const result = { ...user } as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  if (!('scene' in user)) {
    result.scene = defaults.scene;
  } else if (user.scene === null || isCustomEntry(user.scene)) {
    result.scene = user.scene;
  } else {
    const given = givenFields(user.scene ?? {});
    const scene = { ...defaults.scene, ...given };
    result.scene = 'paintBounds' in given
      ? scene
      : { ...scene, paintBounds: paintBoundsFor<TData, TLayer, TPose>(scene.drawOne) };
  }

  if (!('selectionOverlay' in user)) {
    result.selectionOverlay = defaults.selectionOverlay;
  } else if (user.selectionOverlay === null || isCustomEntry(user.selectionOverlay)) {
    result.selectionOverlay = user.selectionOverlay;
  } else {
    result.selectionOverlay = { ...defaults.selectionOverlay, ...givenFields(user.selectionOverlay ?? {}) };
  }

  return result;
}
