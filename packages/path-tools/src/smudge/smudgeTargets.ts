/**
 * What the Smudge brush works on: the paths and text it may push, by one rule
 * for both — what is selected, or with nothing of either selected, everything
 * neither locked nor hidden.
 */
import type { ActionDeps } from '@weasel-js/routing';
import { type NodeId, type PathNode, pathNodesOf, type Scene } from '@weasel-js/core';
import { leavesOf, scenePathNodes } from '../shared/scenePaths';

type AnyScene = Scene<unknown, string, unknown>;

/** The paths a stroke pushes and the text it may convert to push. */
export interface SmudgeTargets {
  paths: PathNode[];
  /** Text node ids; empty in a host that publishes no `createOutlinesAdapter`. */
  texts: NodeId[];
}

function shown(scene: AnyScene | undefined, id: string): boolean {
  return !scene?.isLocked?.(id as NodeId) && !scene?.isHidden?.(id as NodeId);
}

/**
 * The selected paths and text, a selected group standing for its leaves; or,
 * when the selection holds neither, every path and text node that is neither
 * locked nor hidden.
 */
export function smudgeTargets(deps: ActionDeps | undefined): SmudgeTargets {
  const scene = deps?.scene as AnyScene | undefined;
  const isText = (id: string) => deps?.createOutlinesAdapter?.getTextSource(id as NodeId) !== undefined;
  const selected = scene ? leavesOf(scene, deps?.selection?.get() ?? []) : [];
  const picked = { paths: scene ? pathNodesOf(scene, selected) : [], texts: selected.filter(isText) };
  if (picked.paths.length > 0 || picked.texts.length > 0) return picked;
  const all = scene?.renderOrderNodes?.() ?? [];
  return {
    paths: scenePathNodes(deps).filter((n) => shown(scene, n.id)),
    texts: all.filter((n) => n.kind === 'mark' && shown(scene, n.id) && isText(n.id)).map((n) => n.id as NodeId),
  };
}
