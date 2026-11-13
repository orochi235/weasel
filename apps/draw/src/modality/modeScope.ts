import { asNodeId, effectsShowing, type Scene } from '@weasel-js/core';

type ScopeScene = Pick<Scene<unknown, string, unknown>, 'get' | 'renderOrderNodes' | 'getVersion'>;

/**
 * The nodes the current mode leaves lit and reachable: the one node it is on, or none. Path edit on
 * a path an effect hides lights the effects showing it too, so a click on their text can open it.
 * Read per node per paint, so each answer is kept until the target or the scene changes.
 */
export function modeScope(
  machine: { getActiveTargetId(): string | null; registry: { current(): { id: string } } },
  scene: ScopeScene,
): () => ReadonlySet<string> {
  let held: { target: string | null; mode: string; version: number; ids: ReadonlySet<string> } | null = null;
  return () => {
    const target = machine.getActiveTargetId();
    const mode = machine.registry.current().id;
    const version = scene.getVersion();
    if (held?.target === target && held.mode === mode && held.version === version) return held.ids;
    const ids = new Set(target ? [target] : []);
    if (target && mode === 'path-edit') for (const fx of effectsShowing(scene, asNodeId(target), 'path')) ids.add(fx);
    held = { target, mode, version, ids };
    return ids;
  };
}
