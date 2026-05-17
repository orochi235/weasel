/**
 * `useLegacyActionBridges` — registers the 4 actions whose `DepSchema` deps are
 * not yet wired (`delete`, `duplicate`, `group`, `ungroup`) via legacy
 * factory-style descriptors.
 *
 * These run **after** `useStandardActions` so they win on same-id (registry is
 * last-writer-wins). Each bridge uses live refs so captures always read current
 * selection/scene/adapter state.
 *
 * Phase 4 T8 will retire this hook once the 4 actions migrate to the
 * `requires + invoker` pattern with proper dep sources.
 */
import { useEffect, useRef } from 'react';
import { useActionsRegistry } from 'interactions/actions/registry';
import { defaultDeleteAction } from 'interactions/actions/defaults/delete';
import { defaultDuplicateAction } from 'interactions/actions/defaults/duplicate';
import { defaultGroupAction, defaultUngroupAction } from 'interactions/actions/defaults/group';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Group } from 'features/groups/types';

interface BridgeAdapter {
  applyOps(ops: Op[], label?: string): void;
  getGroup?(id: string): Group | undefined;
}

export interface LegacyActionDefaults {
  cloneNode?: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
  duplicateOffset?: { dx: number; dy: number };
}

export function useLegacyActionBridges(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  adapter: BridgeAdapter,
  actionDefaults: LegacyActionDefaults | undefined,
): void {
  const reg = useActionsRegistry();
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const actionDefaultsRef = useRef(actionDefaults);
  actionDefaultsRef.current = actionDefaults;

  useEffect(() => {
    if (!reg) return;

    const getSelection = () => selectionRef.current.current as NodeId[];
    const applyOps = (ops: Op[], label?: string) =>
      adapterRef.current.applyOps(ops, label);
    const getNodeIndex = (id: NodeId) => {
      let i = 0;
      for (const nodeId of sceneRef.current.renderOrder()) {
        if (nodeId === id) return i;
        i++;
      }
      return -1;
    };
    const getNode = (id: NodeId) => sceneRef.current.get(id) ?? null;
    const getGroup = (id: string) => adapterRef.current.getGroup?.(id) as Group | undefined;

    const unregisters: Array<() => void> = [];

    unregisters.push(
      reg.register(
        defaultDeleteAction({ getSelection, getNodeIndex, getNode, applyOps }),
      ),
    );

    const cloneNode = actionDefaultsRef.current?.cloneNode;
    if (cloneNode) {
      const offset = actionDefaultsRef.current?.duplicateOffset;
      unregisters.push(
        reg.register(
          defaultDuplicateAction({ getSelection, cloneNode, applyOps, ...(offset ? { offset } : {}) }),
        ),
      );
    }

    unregisters.push(
      reg.register(defaultGroupAction({ getSelection, applyOps })),
    );

    unregisters.push(
      reg.register(defaultUngroupAction({ getSelection, getGroup, applyOps })),
    );

    return () => { for (const u of unregisters) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg, actionDefaults?.cloneNode, actionDefaults?.duplicateOffset]);
}
