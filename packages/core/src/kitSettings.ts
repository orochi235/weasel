import type { KitSettingsStore } from '@weasel-js/react';
import type { GestureKitSettings } from '@weasel-js/routing';

export type { GestureKitSettings };

/** Core's `targets` leaves: hit radii and overlay dot sizes, in CSS px. */
export interface CoreKitTargetSettings {
  /** Selection corner-handle size and hit radius, before device scaling. */
  handlePx: number;
  /** Path anchor and control-point hit radius, before device scaling. */
  anchorHitPx: number;
  /** Distance from a selection's top edge to the rotation handle, before device scaling. */
  rotationDistancePx: number;
  /** Reach of a path segment being edited. */
  segmentHitPx: number;
  /** Radius around an anchor that a click selects it within. */
  anchorClickPx: number;
  /** Grab slop around a shape's outline. */
  pickTolerancePx: number;
  /** How near a snap target pulls a point, for a snap source that sets no reach of its own. */
  snapPx: number;
  penAnchorRadiusPx: number;
  penHandleDotRadiusPx: number;
  penCloseHintRadiusPx: number;
  /** How near the pen's first anchor a click closes the subpath. */
  penCloseHitPx: number;
  boneJointRadiusPx: number;
  weightPointRadiusPx: number;
  sliceVertexRadiusPx: number;
  /** How near the knife's first point a click closes the cut. */
  sliceCloseHitPx: number;
}

/** Core's `view` area. */
export interface ViewKitSettings {
  /** How long an animated camera move takes, in ms. */
  animationMs: number;
}

declare module '@weasel-js/react' {
  interface KitSettings {
    targets: KitTargetSettings;
    view: ViewKitSettings;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface KitTargetSettings extends CoreKitTargetSettings {}
}

declare module '@weasel-js/routing' {
  interface DepSchema {
    /** The kit settings of the provider above `<SceneCanvas>`, for an action
     *  to read a threshold or radius at the moment it uses one. */
    kitSettings?: KitSettingsStore;
  }
}
