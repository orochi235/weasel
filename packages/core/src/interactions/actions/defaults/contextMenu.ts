import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/routing';
import type { BodyTarget } from '@weasel-js/gestures';
import { scenePoseFrame } from '../poseFrame';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { visualBoundsViaDescriptor } from '../resize/geometry';
import { unionAABB } from 'core/geometry/unionBounds';
import { screenToWorld } from 'core/viewport/viewTransform';
import { viewToTransform } from 'core/viewport/view';

type XY = { x: number; y: number };

/** World center of the selection's bounds, else of the visible canvas. */
export function keyboardAnchor(deps: ActionDeps): XY | null {
  const ids = deps.selection?.get() ?? [];
  if (ids.length && deps.scene) {
    const frame = scenePoseFrame(deps.scene);
    const descriptorOf = nodeDescriptors(deps.scene, poseDescriptorOf(deps.poseDescriptor));
    const box = unionAABB(ids.map((id) => visualBoundsViaDescriptor(frame.world(id), descriptorOf(id))));
    if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  const view = deps.view?.get();
  const size = deps.view?.hostSize?.();
  if (!view || !size) return null;
  const [x, y] = screenToWorld(size.width / 2, size.height / 2, viewToTransform(view));
  return { x, y };
}

/**
 * The hit a menu would be picked for: the shape at `at`, counted as selected
 * because opening selects it first; with no `at`, the current selection.
 */
export function menuHitFor(deps: ActionDeps, at?: XY): { bodyTarget: BodyTarget; bodyKind?: string } {
  if (at) {
    const id = deps.nodeAtPoint?.(at);
    if (!id) return { bodyTarget: 'empty' };
    return { bodyTarget: 'selected-body', bodyKind: (deps.scene?.get(id) as { kind?: string } | undefined)?.kind };
  }
  const ids = deps.selection?.get() ?? [];
  const bodyKind = ids.length === 1 ? (deps.scene?.get(ids[0]!) as { kind?: string } | undefined)?.kind : undefined;
  return { bodyTarget: ids.length ? 'selected-body' : 'empty', bodyKind };
}

/** Open the menu for a right-click, or for Shift+F10 when `params` carry no client point. */
export function openContextMenu(
  deps: ActionDeps,
  params?: Record<string, unknown>,
  anchorOf: (deps: ActionDeps) => XY | null = keyboardAnchor,
): boolean {
  const host = deps.menuHost;
  if (!host) return false;
  const p = params ?? {};
  if (typeof p.clientX === 'number' && typeof p.worldX === 'number') {
    const world = { x: p.worldX, y: p.worldY as number };
    let bodyTarget = p.bodyTarget as BodyTarget | undefined;
    if (bodyTarget === 'unselected-body') {
      const id = deps.nodeAtPoint?.(world);
      if (id) { deps.selection?.set([id]); bodyTarget = 'selected-body'; }
    }
    return host.open({
      hit: { bodyTarget, bodyKind: p.bodyKind as string | undefined },
      client: { x: p.clientX, y: p.clientY as number }, world, source: 'pointer',
    });
  }
  const world = anchorOf(deps);
  const client = world && deps.worldToClient?.(world.x, world.y);
  if (!world || !client) return false;
  return host.open({ hit: menuHitFor(deps), client, world, source: 'keyboard' });
}

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;

/**
 * @experimental
 * Opens the context menu: for the pointer on a right-click or an unclaimed
 * long-press, selecting the shape under it first; for the keyboard on
 * Shift+F10 or the ContextMenu key, at the selection.
 */
export const contextMenuAction: Action & { requires: string[] } = {
  id: 'menu.context',
  label: 'Show Context Menu',
  defaultBinding: [
    { kind: 'contextMenu' },
    { kind: 'key', key: 'F10', mods: { shift: true }, phase: [...INITIAL] },
    { kind: 'key', key: 'ContextMenu', phase: [...INITIAL] },
  ],
  requires: ['menuHost', 'selection', 'nodeAtPoint', 'scene', 'poseDescriptor', 'view', 'worldToClient'],
  // Disabled when no menu would open, so the dispatcher leaves the press, click and drag to whatever else is bound.
  enabled: (deps, at) => (deps?.menuHost?.has({ hit: menuHitFor(deps, at), client: { x: 0, y: 0 }, world: at })
    ? true
    : ActionDisabledReason.NotApplicable),
  invoker: { timing: 'immediate', run: (deps, params) => { openContextMenu(deps, params); } },
};
