import { ActionDisabledReason, type Action, type ActionDeps, type MenuHit } from '@weasel-js/routing';
import { scenePoseFrame } from '../poseFrame';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { visualBoundsViaDescriptor } from '../resize/geometry';
import { unionAABB } from 'core/geometry/unionBounds';
import { screenToWorld } from 'core/viewport/viewTransform';
import { viewToTransform } from 'core/viewport/view';
import { asNodeId } from 'core/scene/types';
import type { Point } from '@weasel-js/geom';

/** World center of the selection's bounds, else of the visible canvas. */
export function keyboardAnchor(deps: ActionDeps): Point | null {
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
 * The hit a menu is picked for, from the dispatcher's own classifier (the
 * `hitAt` and `kindOfNode` deps). A shape under `at` counts as selected, since
 * opening selects it first, and `select` names it when it is not yet; with no
 * `at`, the current selection. Without a classifier wired, a pointer hit names
 * no body at all, and without a selection neither does a keyboard one.
 */
export function menuHitFor(deps: ActionDeps, at?: Point): { hit: MenuHit; select?: string } {
  if (at) {
    const hit = deps.hitAt?.(at);
    if (!hit) return { hit: {} };
    if (hit.bodyTarget === 'empty') return { hit: { bodyTarget: 'empty' } };
    return {
      hit: { bodyTarget: 'selected-body', bodyKind: hit.bodyKind },
      ...(hit.bodyTarget === 'unselected-body' && hit.id !== undefined ? { select: hit.id } : {}),
    };
  }
  if (!deps.selection) return { hit: {} };
  const ids = deps.selection.get();
  return { hit: { bodyTarget: ids.length ? 'selected-body' : 'empty', bodyKind: ids.length === 1 ? deps.kindOfNode?.(ids[0]!) : undefined } };
}

/**
 * Open the menu for a right-click, or for Shift+F10 when `params` carry no client point. Reads
 * only `menuHost`, `view` and `worldToClient` on a surface without a scene; `selection`, `scene`,
 * `hitAt` and `kindOfNode` refine the hit and the keyboard anchor where they are supplied.
 */
export function openContextMenu(
  deps: ActionDeps,
  params?: Record<string, unknown>,
  anchorOf: (deps: ActionDeps) => Point | null = keyboardAnchor,
): boolean {
  const host = deps.menuHost;
  if (!host) return false;
  const p = params ?? {};
  if (typeof p.clientX === 'number' && typeof p.worldX === 'number') {
    const world = { x: p.worldX, y: p.worldY as number };
    const { hit, select } = menuHitFor(deps, world);
    if (select) deps.selection?.set([asNodeId(select)]);
    return host.open({
      hit,
      client: { x: p.clientX, y: p.clientY as number }, world, source: 'pointer',
    });
  }
  const world = anchorOf(deps);
  const client = world && deps.worldToClient?.(world.x, world.y);
  if (!world || !client) return false;
  return host.open({ hit: menuHitFor(deps).hit, client, world, source: 'keyboard' });
}

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;

/**
 * Opens the context menu: for the pointer on a right-click or an unclaimed
 * long-press, selecting the shape under it first; for the keyboard on
 * Shift+F10 or the ContextMenu key, at the selection or else the middle of the view.
 */
export const contextMenuAction: Action & { requires: string[] } = {
  id: 'menu.context',
  label: 'Show Context Menu',
  defaultBinding: [
    { kind: 'contextMenu' },
    { kind: 'key', key: 'F10', mods: { shift: true }, phase: [...INITIAL] },
    { kind: 'key', key: 'ContextMenu', phase: [...INITIAL] },
  ],
  requires: ['menuHost', 'selection', 'scene', 'poseDescriptor', 'view', 'worldToClient', 'hitAt', 'kindOfNode'],
  // Disabled when no menu would open, so the dispatcher leaves the press, click and drag to whatever else is bound.
  enabled: (deps, at) => (deps?.menuHost?.has({ hit: menuHitFor(deps, at).hit, client: { x: 0, y: 0 }, world: at })
    ? true
    : ActionDisabledReason.NotApplicable),
  invoker: { timing: 'immediate', run: (deps, params) => { openContextMenu(deps, params); } },
};
