import { useCommand } from '@weasel-js/core';
import { BETWEEN_GESTURES } from '@weasel-js/routing';
import type { EffectEditorApi } from '@weasel-js/diagram/effect';
import type { RefObject } from 'react';
import { menuRun, type MenuRuns } from '@weasel-js/editor';
import { can } from '../menuBar';

export const CLUSTER_ACTIONS = { cluster: 'pipeline.cluster', dissolveCluster: 'pipeline.dissolveCluster' } as const;

/** Pipeline mode's Arrange menu. */
export const ARRANGE_MENU: MenuRuns = {
  clusters: menuRun({ cluster: CLUSTER_ACTIONS.cluster, dissolveCluster: CLUSTER_ACTIONS.dissolveCluster }),
};

/** What is picked in the editor, and how to pick a cluster. */
export interface ClusterPicks {
  stage: string | null;
  cluster: string | null;
  /** Every stage and cluster picked, Cmd-clicks and ranges included. */
  picked: readonly string[];
  pickCluster: (id: string | null) => void;
}

/** Registers Arrange › Group, which clusters every picked stage and cluster and picks the new cluster, and
 *  Ungroup, which dissolves the picked cluster. */
export function useClusterCommands(editor: RefObject<EffectEditorApi | null>, picks: ClusterPicks): void {
  const { stage, cluster, picked, pickCluster } = picks;
  const target = stage ?? cluster;
  const ids = picked.length > 0 ? picked : target === null ? [] : [target];
  useCommand(CLUSTER_ACTIONS.cluster, 'Group', () => {
    const made = ids.length === 0 ? null : editor.current?.cluster(ids) ?? null;
    if (made !== null) pickCluster(made);
  }, { enabled: () => can(ids.length > 0), keys: { spec: { kind: 'key', key: 'g', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: `${CLUSTER_ACTIONS.cluster}.key` } } });
  useCommand(CLUSTER_ACTIONS.dissolveCluster, 'Ungroup', () => {
    if (cluster === null) return;
    editor.current?.dissolveCluster(cluster);
    pickCluster(null);
  }, { enabled: () => can(cluster !== null), keys: { spec: { kind: 'key', key: 'g', mods: { mod: true, shift: true }, phase: BETWEEN_GESTURES }, opts: { id: `${CLUSTER_ACTIONS.dissolveCluster}.key` } } });
}
