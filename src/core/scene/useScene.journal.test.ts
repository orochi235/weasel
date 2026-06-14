/**
 * Tests for UseSceneOptions.getActiveJournal — journal-aware routing in
 * scene.applyBatch (and by extension sceneToAdapter.applyOps which calls it).
 *
 * The three behaviours verified:
 *   1. Without a journal accessor, adapter.applyOps records to the scene's
 *      own undo history (scene.canUndo() becomes true).
 *   2. With an active journal, adapter.applyOps routes to the journal — the
 *      scene's undo stack gets no new entry; the journal's inner stack does.
 *      After journal.commit, the parent weasel-history History has one entry.
 *   3. After the journal closes (committed + accessor cleared), subsequent
 *      adapter.applyOps routes back to the scene's undo stack.
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createHistory } from '@weasel-js/history';
import type { Journal } from '@weasel-js/history';
import { useScene } from './useScene';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { createTransformOp } from 'core/ops/transform';
import { asNodeId } from './types';

// ── shared test fixture ───────────────────────────────────────────────────────

interface Pose { x: number; y: number; width: number; height: number }

const INITIAL_POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const UPDATED_POSE: Pose = { x: 1, y: 1, width: 10, height: 10 };

function makeSceneWithJournal(getJournal: () => Journal | null) {
  const { result } = renderHook(() =>
    useScene<{ label: string }, 'default', Pose>({
      systemLayers: [{ id: 'default' }],
      initial: [
        {
          kind: 'leaf',
          layer: 'default',
          pose: INITIAL_POSE,
          data: { label: 'node-a' },
          id: asNodeId('node-a'),
        },
      ],
      getActiveJournal: getJournal,
    }),
  );
  return result.current;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useScene journal routing via scene.applyBatch', () => {
  it('without a journal accessor, applyOps records to the scene undo stack', () => {
    const scene = makeSceneWithJournal(() => null);
    const adapter = sceneToAdapter(scene);

    // Scene starts clean (initial nodes are not undoable)
    expect(scene.canUndo()).toBe(false);

    act(() => {
      adapter.applyOps(
        [createTransformOp({ id: 'node-a', from: INITIAL_POSE, to: UPDATED_POSE })],
        'move',
      );
    });

    expect(scene.canUndo()).toBe(true);
  });

  it('with an active journal, applyOps routes to the journal; scene stack is not populated', () => {
    let activeJournal: Journal | null = null;
    const scene = makeSceneWithJournal(() => activeJournal);
    const adapter = sceneToAdapter(scene);

    // Create a weasel-history History backed by the same adapter, then open a
    // journal. The journal's inner history will track ops; the scene's own
    // undo stack should stay empty.
    const history = createHistory(adapter);
    activeJournal = history.beginJournal({ label: 'edit' });

    act(() => {
      adapter.applyOps(
        [createTransformOp({ id: 'node-a', from: INITIAL_POSE, to: UPDATED_POSE })],
        'move',
      );
    });

    // Scene undo stack untouched
    expect(scene.canUndo()).toBe(false);
    // Journal's inner stack has the entry
    expect(activeJournal.entries().undo.length).toBe(1);
    // Mutation still applied to scene state
    expect(scene.get(asNodeId('node-a'))!.pose).toEqual(UPDATED_POSE);

    // Commit flushes one labeled entry to the parent weasel-history History
    activeJournal.commit('edit');
    expect(history.entries().undo.length).toBe(1);
  });

  it('after journal closes, applyOps routes back to the scene undo stack', () => {
    let activeJournal: Journal | null = null;
    const scene = makeSceneWithJournal(() => activeJournal);
    const adapter = sceneToAdapter(scene);

    // Open and commit a journal, then clear the reference
    const history = createHistory(adapter);
    activeJournal = history.beginJournal({ label: 'j' });
    activeJournal.commit('j');
    activeJournal = null;

    const undoBefore = scene.historyEntries().length;

    act(() => {
      adapter.applyOps(
        [createTransformOp({ id: 'node-a', from: INITIAL_POSE, to: UPDATED_POSE })],
        'post-journal move',
      );
    });

    // One new entry on the scene's stack
    expect(scene.historyEntries().length).toBe(undoBefore + 1);
  });

  it('setActiveJournalAccessor wires the accessor after construction', () => {
    // Build the scene WITHOUT getActiveJournal in options. This mirrors the
    // common pattern where the journal source (a mode machine) depends on
    // the scene itself, creating a circular construction dependency.
    const { result } = renderHook(() =>
      useScene<{ label: string }, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          { kind: 'leaf', layer: 'default', pose: INITIAL_POSE, data: { label: 'node-a' }, id: asNodeId('node-a') },
        ],
      }),
    );
    const scene = result.current;
    const adapter = sceneToAdapter(scene);

    // No journal yet — applyOps lands on the scene's own stack.
    const undoBefore = scene.historyEntries().length;
    act(() => {
      adapter.applyOps(
        [createTransformOp({ id: 'node-a', from: INITIAL_POSE, to: UPDATED_POSE })],
        'pre-wire',
      );
    });
    expect(scene.historyEntries().length).toBe(undoBefore + 1);

    // Wire the accessor post-construction. Now applyOps routes to the journal.
    const history = createHistory(adapter);
    const journal = history.beginJournal({ label: 'edit' });
    scene.setActiveJournalAccessor(() => journal);

    const undoAfterWire = scene.historyEntries().length;
    act(() => {
      adapter.applyOps(
        [createTransformOp({ id: 'node-a', from: UPDATED_POSE, to: INITIAL_POSE })],
        'in-journal',
      );
    });
    // Scene's stack didn't grow — the op went to the journal.
    expect(scene.historyEntries().length).toBe(undoAfterWire);
    expect(journal.entries().undo.length).toBe(1);

    // Detach. Subsequent ops go back to the scene.
    scene.setActiveJournalAccessor(null);
    const undoAfterDetach = scene.historyEntries().length;
    act(() => {
      adapter.applyOps(
        [createTransformOp({ id: 'node-a', from: INITIAL_POSE, to: UPDATED_POSE })],
        'post-detach',
      );
    });
    expect(scene.historyEntries().length).toBe(undoAfterDetach + 1);
  });
});
