import type { ParallaxOptions } from '../viewport/parallax';

interface LayerRecordBase<TLayer extends string> {
  id: TLayer;
  visible: boolean;
  locked: boolean;
  /** Draw this layer as a parallax plane: through a view derived from the
   *  camera's (see `deriveParallaxView`), and picked through the same one.
   *  Absent means the layer moves with the camera. */
  parallax?: ParallaxOptions;
  /** A non-printing layer of aids — measurements, notes — rather than content.
   *  Its nodes draw on the canvas and save with the scene, but export leaves
   *  them out and content picking passes through them. Read it through
   *  `isAnnotationLayer`. Absent means content. */
  annotation?: boolean;
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
  parallax?: ParallaxOptions;
  /** See `LayerRecord.annotation`. */
  annotation?: boolean;
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
  parallax?: ParallaxOptions;
  /** See `LayerRecord.annotation`. */
  annotation?: boolean;
  /** Render-stack position. Default: top of stack (highest render index). */
  index?: number;
}

/** The scene's layer edits. Each is one undoable step. */
export interface SceneLayerMembers<TLayer extends string> {
  /** Show or hide a layer. Hiding drops its nodes from the selection. */
  setLayerVisible(layer: TLayer, visible: boolean): void;
  /** Lock or unlock a layer. A locked layer still paints, but its nodes are
   *  out of reach: picking and area selection pass over them, the selection
   *  drops them, and every node mutation on them throws. Locking is never
   *  blocked by the lock, and neither are the other layer operations. */
  setLayerLocked(layer: TLayer, locked: boolean): void;
  /** Set or clear (`undefined`) a layer's parallax — see
   *  `LayerRecord.parallax`. Undoable; an animation tweening it writes inside
   *  `Scene.untracked` so no frame becomes an undo step. */
  setLayerParallax(layer: TLayer, parallax: ParallaxOptions | undefined): void;
  /** Add a user layer, at `spec.index` in the stack or on top, as one
   *  undoable step. Throws when a layer already has the id. */
  addLayer(spec: AddLayerSpec<TLayer>): void;
  /** Drop a user layer and every node tagged to it, as one undoable step.
   *  Removal cascades, so this also deletes nodes **on other layers** that
   *  derive from a node on this one. */
  removeLayer(layer: TLayer): void;
  /** Rename a user layer, as one undoable step. Throws on a system layer. */
  renameLayer(layer: TLayer, name: string): void;
  /** Move a layer to `index` in the stack, held to either end, as one
   *  undoable step. Throws when that would paint a child below its parent. */
  moveLayer(layer: TLayer, index: number): void;
}
