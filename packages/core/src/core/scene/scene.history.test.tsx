/**
 * `scene.history` — the `History` façade a consumer resolves the kit's
 * `history` dep to. The façade exists so an action-driven undo takes the same
 * route as `scene.undo()`: recording suppressed while the engine replays, one
 * `notify()` after. Handing out the raw engine would mutate the scene behind
 * every subscriber's back, so several of these tests assert the notification,
 * not just the mutation.
 */
import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { createScene } from './scene';
import type { NodeId, Scene } from './types';
import type { Op } from 'core/ops/types';
import {
  ActionsProvider,
  useActionsRegistry,
  type ActionsRegistry,
} from 'interactions/actions/registry';
import { DepRegistryProvider } from 'interactions/actions/depRegistry';
import { useStandardActions } from 'interactions/actions/useStandardActions';
import type { History } from '@weasel-js/history';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene(): Scene<Data, Layer> {
  return createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
}

function addNode(scene: Scene<Data, Layer>, label: string): NodeId {
  return scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label } });
}

/** An op that mutates through the scene's own public methods — the shape that
 *  re-enters `executeAndLog` and double-records when the engine drives it
 *  without the scene's suppression. */
function addNodeOp(scene: Scene<Data, Layer>, id: NodeId, label: string): Op {
  return {
    label: `add ${label}`,
    apply: () => {
      scene.add({ id, kind: 'leaf', layer: 'main', pose: POSE, data: { label } });
    },
    invert: () => ({
      label: `remove ${label}`,
      apply: () => { scene.remove(id); },
      invert: () => addNodeOp(scene, id, label),
    }),
  };
}

// ---------------------------------------------------------------------------
// The dep, resolved for real and driven through the kit's undo/redo actions
// ---------------------------------------------------------------------------

function Harness({
  history,
  onRegistry,
}: {
  history: History;
  onRegistry: (r: ActionsRegistry) => void;
}) {
  useStandardActions({ history });
  const reg = useActionsRegistry();
  useEffect(() => { if (reg) onRegistry(reg); }, [reg, onRegistry]);
  return null;
}

function mountActions(history: History): ActionsRegistry {
  let captured: ActionsRegistry | null = null;
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <Harness history={history} onRegistry={(r) => { captured = r; }} />
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  if (!captured) throw new Error('ActionsRegistry never published');
  return captured;
}

describe('scene.history as the resolved `history` dep', () => {
  it('drives undo and redo through the kit `undo` / `redo` actions', () => {
    const scene = makeScene();
    const reg = mountActions(scene.history);
    addNode(scene, 'a');
    expect(scene.nodes.size).toBe(1);

    act(() => { reg.trigger('undo'); });
    expect(scene.nodes.size).toBe(0);

    act(() => { reg.trigger('redo'); });
    expect(scene.nodes.size).toBe(1);
  });

  // The mutation here goes in as an *external* op — one whose inverse calls
  // `scene.remove` — because that is the case a raw-engine `history` gets
  // wrong. A kit op's inverse reverts through the registered handler and never
  // re-enters a scene method, so it would pass either way.
  it('bumps the scene version once, and records nothing, on an action-driven undo', () => {
    const scene = makeScene();
    const reg = mountActions(scene.history);
    scene.applyBatch([addNodeOp(scene, 'n1' as NodeId, 'a')], 'insert', null);
    expect(scene.nodes.size).toBe(1);

    const listener = vi.fn();
    scene.subscribe(listener);
    const before = scene.getVersion();

    act(() => { reg.trigger('undo'); });

    expect(scene.nodes.size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(scene.getVersion()).toBeGreaterThan(before);
    // The replayed inverse must not re-record: one entry moved undo → redo.
    expect(scene.history.undoDepth()).toBe(0);
    expect(scene.history.redoDepth()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Per-member routing
// ---------------------------------------------------------------------------

describe('scene.history façade routing', () => {
  it('undo / redo go through the scene wrappers (suppressed + notified)', () => {
    const scene = makeScene();
    addNode(scene, 'a');
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.undo();
    expect(scene.nodes.size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
    // Undo must not push an inverse entry of its own.
    expect(scene.history.undoDepth()).toBe(0);
    expect(scene.history.redoDepth()).toBe(1);

    scene.history.redo();
    expect(scene.nodes.size).toBe(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('goto walks through jumpToHistoryIndex — notifies once', () => {
    const scene = makeScene();
    addNode(scene, 'a');
    addNode(scene, 'b');
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.goto(0);
    expect(scene.nodes.size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);

    scene.history.goto(2);
    expect(scene.nodes.size).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('applyOps suppresses scene-side recording and notifies once', () => {
    const scene = makeScene();
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.applyOps([addNodeOp(scene, 'n1' as NodeId, 'a')], 'insert');

    expect(scene.nodes.size).toBe(1);
    // One entry, not two: the op's re-entry into `scene.add` must not record.
    expect(scene.history.undoDepth()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    scene.history.undo();
    expect(scene.nodes.size).toBe(0);
  });

  it('apply suppresses scene-side recording and notifies once', () => {
    const scene = makeScene();
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.apply(addNodeOp(scene, 'n1' as NodeId, 'a'), 'insert');

    expect(scene.nodes.size).toBe(1);
    expect(scene.history.undoDepth()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clear drops the stacks and notifies', () => {
    const scene = makeScene();
    addNode(scene, 'a');
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.clear();
    expect(scene.history.undoDepth()).toBe(0);
    expect(scene.canUndo()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('recordEntry pushes without applying, and notifies', () => {
    const scene = makeScene();
    const id = addNode(scene, 'a');
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.recordEntry([addNodeOp(scene, id, 'a')], 'already applied');
    expect(scene.nodes.size).toBe(1);
    expect(scene.history.undoDepth()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('restore replaces the stacks and notifies', () => {
    const scene = makeScene();
    addNode(scene, 'a');
    const snapshot = scene.history.serialize();
    scene.history.clear();
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.history.restore(snapshot);
    expect(scene.history.undoDepth()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('forwards the read-only members to the engine', () => {
    const scene = makeScene();
    const v0 = scene.history.getVersion();
    const engineListener = vi.fn();
    const off = scene.history.subscribe(engineListener);

    addNode(scene, 'a');
    expect(engineListener).toHaveBeenCalled();
    expect(scene.history.getVersion()).toBeGreaterThan(v0);
    expect(scene.history.canUndo()).toBe(true);
    expect(scene.history.canRedo()).toBe(false);
    expect(scene.history.entries().undo).toHaveLength(1);
    expect(scene.history.allForwardOps()).toHaveLength(1);
    expect(scene.history.currentEntryId()).toBeGreaterThan(0);
    off();
  });
});

describe('scene.history journals', () => {
  it('routes journal mutation through the scene (suppressed + notified)', () => {
    const scene = makeScene();
    const journal = scene.history.beginJournal({ label: 'session' });
    const listener = vi.fn();
    scene.subscribe(listener);

    journal.applyBatch([addNodeOp(scene, 'n1' as NodeId, 'a')], 'insert');
    expect(scene.nodes.size).toBe(1);
    // The journal's entry belongs to the journal, not the parent stack.
    expect(scene.history.undoDepth()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);

    journal.undo();
    expect(scene.nodes.size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);

    journal.redo();
    expect(scene.nodes.size).toBe(1);

    journal.commit('session');
    expect(scene.history.undoDepth()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('cancel rewinds the session and notifies', () => {
    const scene = makeScene();
    const journal = scene.history.beginJournal({ label: 'session' });
    journal.applyBatch([addNodeOp(scene, 'n1' as NodeId, 'a')], 'insert');
    const listener = vi.fn();
    scene.subscribe(listener);

    journal.cancel();
    expect(scene.nodes.size).toBe(0);
    expect(scene.history.undoDepth()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resumeJournal accepts the journal beginJournal handed back', () => {
    const scene = makeScene();
    const journal = scene.history.beginJournal({ label: 'session' });
    journal.suspend();
    expect(journal.isActive()).toBe(false);

    scene.history.resumeJournal(journal);
    expect(journal.isActive()).toBe(true);

    journal.applyBatch([addNodeOp(scene, 'n1' as NodeId, 'a')], 'insert');
    expect(scene.nodes.size).toBe(1);
    journal.commit('session');
  });
});
