import type { ParallaxOpts } from '../viewport/parallax';

interface LayerRecordBase<TLayer extends string> {
  id: TLayer;
  visible: boolean;
  locked: boolean;
  /** Draw this layer as a parallax plane: through a view derived from the
   *  camera's (see `deriveParallaxView`), and picked through the same one.
   *  Absent means the layer moves with the camera. */
  parallax?: ParallaxOpts;
}

/** A layer declared when the scene was created. Fixed set, no display name —
 *  these are the kit's own render bands, not something a user manages. */
export interface SystemLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'system';
}

/** A layer the user created and can rename, reorder or delete. */
export interface UserLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'user';
  name: string;
}

/** Per-layer metadata held by the scene: whether it is visible and locked,
 *  and where it sits in the render stack. Distinct from a node's `layer` tag,
 *  which merely names one of these. */
export type LayerRecord<TLayer extends string> =
  | SystemLayerRecord<TLayer>
  | UserLayerRecord<TLayer>;

/** One of the layers a scene is created with. */
export interface SystemLayerSpec<TLayer extends string> {
  id: TLayer;
  visible?: boolean;
  locked?: boolean;
  /** See `LayerRecord.parallax`. */
  parallax?: ParallaxOpts;
}

/** Argument to `Scene.addLayer`. Always produces a `UserLayerRecord`
 *  (`kind: 'user'`). */
export interface AddLayerSpec<TLayer extends string> {
  id: TLayer;
  name: string;
  /** Default `true`. */
  visible?: boolean;
  /** Default `false`. */
  locked?: boolean;
  /** See `LayerRecord.parallax`. */
  parallax?: ParallaxOpts;
  /** Render-stack position. Default: top of stack (highest render index). */
  index?: number;
}
