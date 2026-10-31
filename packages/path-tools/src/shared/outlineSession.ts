/**
 * Text a path gesture reaches, converted to outlines as Create Outlines does,
 * so the gesture can go on to reshape its paths. The conversions happen for
 * real mid-gesture, so the gesture runs inside a journal on the scene's
 * history, opened at the first one: its commit lands the conversions and the
 * gesture's own edit as one undo entry, and its cancel puts the text back.
 */
import type { ActionDeps } from '@weasel-js/routing';
import {
  applyCreateOutlines, type Journal, loadTextOutlines, type NodeId, type PathNode, pathNodesOf, type Scene, warnTextOutlines,
} from '@weasel-js/core';
import { leavesOf } from './scenePaths';

type AnyScene = Scene<unknown, string, unknown>;

/** One gesture's conversions of the text it may reach. */
export interface OutlineSession {
  /** Convert each text node still waiting that `reaches` accepts; answers the
   *  paths that took their place. A node whose face is still loading waits for
   *  a later call; one that cannot be converted is dropped, and the first such
   *  in the gesture is reported through the `notices` dep. */
  convert(reaches?: (id: NodeId, scene: AnyScene) => boolean): PathNode[];
  /** Run `apply`, the gesture's own commit, and land everything as one entry
   *  under `label`. */
  commit(apply: () => void, label: string): void;
  /** Put back every text node the gesture converted. */
  cancel(): void;
}

/** The conversions a gesture over `texts` may make, journaled under `label`
 *  until it ends. Without a `createOutlinesAdapter`, a scene, or a history to
 *  journal on, text is left alone. */
export function outlineSession(deps: ActionDeps, texts: readonly NodeId[], label: string): OutlineSession {
  const adapter = deps.createOutlinesAdapter;
  const scene = deps.scene as AnyScene | undefined;
  const history = deps.history;
  const waiting = new Set(adapter && scene && history ? texts : []);
  const loading = new Set<NodeId>();
  let journal: Journal | null = null;
  let warned = false;

  function open(): boolean {
    if (journal) return true;
    try {
      journal = history!.beginJournal({ label });
      return true;
    } catch {
      waiting.clear();
      return false;
    }
  }

  function convertOne(id: NodeId): PathNode[] {
    const result = applyCreateOutlines(adapter!, [id]);
    if (result.kind === 'applied') {
      waiting.delete(id);
      return pathNodesOf(scene!, leavesOf(scene!, result.resultIds));
    }
    if (result.kind === 'failed' && result.error.reason === 'outlines-loading') {
      // A face is parsed on first use: try again once it has been.
      const source = adapter!.getTextSource(id);
      loading.add(id);
      void (source ? loadTextOutlines(source.data) : Promise.resolve()).finally(() => loading.delete(id));
      return [];
    }
    waiting.delete(id);
    if (result.kind === 'failed' && !warned) {
      warned = true;
      warnTextOutlines(deps.notices, label, result.error);
    }
    return [];
  }

  return {
    convert(reaches) {
      const out: PathNode[] = [];
      for (const id of [...waiting]) {
        if (loading.has(id)) continue;
        if (!scene!.get(id)) { waiting.delete(id); continue; }
        if (reaches && !reaches(id, scene!)) continue;
        if (!open()) break;
        out.push(...convertOne(id));
      }
      return out;
    },
    commit(apply, commitLabel) {
      apply();
      if (!journal) return;
      // A journal whose every conversion failed holds nothing to undo.
      if (journal.entries().undo.length > 0) journal.commit(commitLabel);
      else journal.cancel();
      journal = null;
    },
    cancel() {
      journal?.cancel();
      journal = null;
    },
  };
}
