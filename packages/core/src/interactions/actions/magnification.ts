import { magnificationOf } from '@weasel-js/quantity';
import { sceneDeclaredScopes } from 'core/scene/unitScopes';
import type { NodeId, Scene } from 'core/scene/types';
import { sceneBoxFrames } from './poseFrame';

/** A container whose children are drawn at a size its unit scopes do not declare. */
export interface UndeclaredMagnification {
  id: NodeId;
  /** How large its children's frame is drawn in world, on each of its axes. */
  drawn: { x: number; y: number };
  /** The magnification its scope chain declares: every `drawnAt`, multiplied. */
  declared: number;
}

const differs = (a: number, b: number, tolerance: number): boolean => Math.abs(a / b - 1) > tolerance;

/**
 * Every container in `scene` whose children are drawn magnified, by a scale
 * `transform` on it or above it, by more or less than the `drawnAt` of the unit
 * scopes it sits in and declares. Only containers under some declared scope
 * are read: a scene stating no units says nothing about what size it draws at.
 */
export function undeclaredMagnifications(
  scene: Scene<unknown, string, unknown>,
  tolerance = 1e-6,
): UndeclaredMagnification[] {
  const frames = sceneBoxFrames(scene);
  const out: UndeclaredMagnification[] = [];
  for (const id of scene.nodes.keys()) {
    if (scene.childrenOf(id).length === 0) continue;
    const scopes = sceneDeclaredScopes(scene, id, { inclusive: true });
    if (scopes.length === 0) continue;
    const f = frames(id);
    if (f === null) continue;
    const drawn = { x: Math.hypot(f[0], f[1]), y: Math.hypot(f[2], f[3]) };
    const declared = magnificationOf(scopes);
    if (differs(drawn.x, declared, tolerance) || differs(drawn.y, declared, tolerance)) out.push({ id, drawn, declared });
  }
  return out;
}
