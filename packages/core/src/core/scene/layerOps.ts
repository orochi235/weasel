/**
 * The kit's layer op kinds: visibility, lock, parallax, and adding, removing,
 * renaming, and moving a layer.
 */
import type { ParallaxOpts } from 'core/viewport/parallax';
import type { KitOpsEnv } from './kitOps';
import type { LayerRecord, RegisteredOp, UserLayerRecord } from './types';

function setParallax(record: { parallax?: ParallaxOpts }, to: ParallaxOpts | undefined): void {
  if (to === undefined) delete record.parallax;
  else record.parallax = to;
}

/** Register the layer op kinds against `env`'s layer stack. */
export function registerLayerOps<TData, TLayer extends string, TPose>(
  env: Pick<KitOpsEnv<TData, TLayer, TPose>, 'state' | 'register' | 'requireLayerIndex' | 'rebuildLayerIndex' | 'narrowSelection'>,
): void {
  const { state, requireLayerIndex, rebuildLayerIndex } = env;
  function registerKitOp<P>(kind: string, handler: RegisteredOp<P>): void {
    env.register(kind, handler as RegisteredOp<unknown>);
  }

  registerKitOp<{ layer: TLayer; from: boolean; to: boolean }>('kit:setLayerVisible', {
    apply: (p) => { state.layers[requireLayerIndex(p.layer)].visible = p.to; if (!p.to) env.narrowSelection(); },
    revert: (p) => { state.layers[requireLayerIndex(p.layer)].visible = p.from; },
  });

  registerKitOp<{ layer: TLayer; from: boolean; to: boolean }>('kit:setLayerLocked', {
    apply: (p) => { state.layers[requireLayerIndex(p.layer)].locked = p.to; if (p.to) env.narrowSelection(); },
    revert: (p) => { state.layers[requireLayerIndex(p.layer)].locked = p.from; },
  });

  registerKitOp<{ layer: TLayer; from?: ParallaxOpts; to?: ParallaxOpts }>('kit:setLayerParallax', {
    apply: (p) => { setParallax(state.layers[requireLayerIndex(p.layer)], p.to); },
    revert: (p) => { setParallax(state.layers[requireLayerIndex(p.layer)], p.from); },
  });

  registerKitOp<{ record: UserLayerRecord<TLayer>; index: number }>('kit:addLayer', {
    apply: (p) => { state.layers.splice(p.index, 0, { ...p.record }); rebuildLayerIndex(); },
    revert: (p) => { state.layers.splice(p.index, 1); rebuildLayerIndex(); },
  });

  registerKitOp<{ record: LayerRecord<TLayer>; index: number }>('kit:removeLayer', {
    apply: (p) => { state.layers.splice(p.index, 1); rebuildLayerIndex(); },
    revert: (p) => { state.layers.splice(p.index, 0, { ...p.record } as LayerRecord<TLayer>); rebuildLayerIndex(); },
  });

  registerKitOp<{ layer: TLayer; from: string; to: string }>('kit:renameLayer', {
    apply: (p) => { (state.layers[requireLayerIndex(p.layer)] as UserLayerRecord<TLayer>).name = p.to; },
    revert: (p) => { (state.layers[requireLayerIndex(p.layer)] as UserLayerRecord<TLayer>).name = p.from; },
  });

  /** Finds the layer by id, not by where the payload last left it: moves of
   *  one layer coalesce, and the entry then reverts the first payload from
   *  wherever the last one put the layer. */
  function placeLayer(layer: TLayer, index: number): void {
    const [rec] = state.layers.splice(requireLayerIndex(layer), 1);
    state.layers.splice(index, 0, rec);
    rebuildLayerIndex();
  }

  registerKitOp<{ layer: TLayer; from: number; to: number }>('kit:moveLayer', {
    apply: (p) => placeLayer(p.layer, p.to),
    revert: (p) => placeLayer(p.layer, p.from),
  });
}
