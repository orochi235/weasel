import type { PlaneMap } from 'core/viewport/parallax';

/**
 * What a behavior needs to take a pose between the frame a node stores it in
 * and world. A node under a container whose pose is a frame stores its pose
 * in that frame, so a stored pose and a world pose are different values
 * there; under the default composition they are the same and every method is
 * an identity.
 */
export interface GestureFrames<TPose> {
  /** `id`'s pose in world, as the scene shows it now: the gesture's preview
   *  once one is published. */
  world(id: string): TPose;
  /** `pose`, as `id` stores it, in world. */
  toWorld(id: string, pose: TPose): TPose;
  /** `worldPose` as `id` stores it: what a pose op or a preview takes. */
  toLocal(id: string, worldPose: TPose): TPose;
  /** How the world the gesture edits in maps into the world `layer`'s nodes
   *  are stored in, read now. Null when they are the same world. */
  planeOf(layer: string): PlaneMap | null;
}
