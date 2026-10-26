import type { PlaneMap } from 'core/viewport/parallax';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/**
 * What a behavior needs to take a pose between the frame a node stores it in
 * and world. A node under a container whose pose is a frame stores its pose
 * in that frame, so a stored pose and a world pose are different values
 * there; under `IDENTITY_POSE_COMPOSITION` they are the same and every
 * method is an identity.
 */
export interface GestureFrames<TPose> {
  /** `id`'s pose in world, as the scene shows it now: the gesture's preview
   *  once one is published. */
  world(id: string): TPose;
  /** `pose`, as `id` stores it, in world. */
  toWorld(id: string, pose: TPose): TPose;
  /** `worldPose` as `id` stores it: what a pose op or a preview takes. */
  toLocal(id: string, worldPose: TPose): TPose;
  /** `worldPose` as a child of `parentId` stores it, `null` for the top of
   *  the tree: what a node reparented there is posed with. */
  toLocalUnder(parentId: string | null, worldPose: TPose): TPose;
  /** How the world the gesture edits in maps into the world `layer`'s nodes
   *  are stored in, read now. Null when they are the same world. */
  planeOf(layer: string): PlaneMap | null;
  /** The axis-aligned box `id` covers drawn at `worldPose`: its stroke
   *  included unless the canvas opted out. What a snap that lines boxes up
   *  measures, so it agrees with the selection chrome. */
  drawnBounds?(id: string, worldPose: TPose): Bounds;
}
