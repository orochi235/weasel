import { describe, it, expect, vi } from 'vitest';
import { ActionDisabledReason } from '@weasel-js/routing';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('domains/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('domains/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

describe('usePenTool', () => {
  it('clicking first anchor (≥3 anchors) closes the subpath and auto-commits (default)', () => {
    const p = setup({ closeHitRadius: 8 });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(1, 1); // within the close-hit radius of the first anchor
    expect(p.adapter.added.map((a) => a.closed)).toEqual([true]);
    expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('the close-hit radius is measured in screen px, so it shrinks as you zoom in', () => {
    // radius = closeHitRadius / meanScale(view.scale) — the `view` dep is
    // what the action reads for it.
    const p = setup({ closeHitRadius: 8, scale: 4 });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    // 3 world px away: inside 8px at scale 1, outside the 2px at scale 4.
    p.click(3, 0);
    expect(p.adapter.addNode).not.toHaveBeenCalled();
    expect(p.scratch.current!.anchors).toHaveLength(4);
  });

  it('autoCommitOnClose: false → close-on-first-anchor parks the subpath in scratch', () => {
    const p = setup({ closeHitRadius: 8, autoCommitOnClose: false });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(1, 1);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths.length).toBe(1);
    expect(p.scratch.finishedSubpaths[0].closed).toBe(true);
    expect(p.scratch.finishedSubpaths[0].anchors.length).toBe(3);
    expect(p.adapter.addNode).not.toHaveBeenCalled();
  });

  it('clicking first anchor with <3 anchors → appends instead of closing (degenerate)', () => {
    const p = setup();
    p.click(0, 0); p.click(50, 0);
    p.click(1, 1);
    expect(p.scratch.current).not.toBeNull();
    expect(p.scratch.finishedSubpaths.length).toBe(0);
    expect(p.scratch.current!.anchors.length).toBe(3);
  });

  it('Enter in Drawing → open-finishes, commits, auto-selects, returns to Idle', () => {
    const p = setup();
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    expect(p.enter()).toBe(true);
    expect(p.adapter.added.map((a) => a.closed)).toEqual([false]);
    expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
    expect(p.adapter.setSelection).toHaveBeenCalledWith([p.adapter.ids[0]]);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('Enter in BetweenSubpaths → commits, returns to Idle', () => {
    const p = setup({ autoCommitOnClose: false });
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.click(1, 1);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths.length).toBe(1);
    p.enter();
    expect(p.adapter.added.map((a) => a.closed)).toEqual([true]);
    expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
  });

  it('Enter with nothing drawn declines, so the key falls through', () => {
    const p = setup();
    expect(p.enter()).toBe(false);
    expect(p.actionOf('pen.finish').enabled?.()).toBe(ActionDisabledReason.NotApplicable);
  });

  it('Esc → discards everything', () => {
    const p = setup();
    p.click(0, 0); p.click(50, 0);
    expect(p.escape()).toBe(true);
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
    expect(p.adapter.addNode).not.toHaveBeenCalled();
  });

  it('Esc with nothing drawn declines, keeping the escape ladder intact', () => {
    // An idle pen must not swallow Escape: the ambient `escape` action goes
    // on to clear the selection / return to the default tool.
    const p = setup();
    expect(p.escape()).toBe(false);
    expect(p.actionOf('pen.cancel').enabled?.()).toBe(ActionDisabledReason.NotApplicable);
  });

  it('tool-switch (onDeactivate) discards in-progress path regardless of anchor count', () => {
    // Mirrors the Escape contract: an in-progress path is by definition
    // incomplete (the user didn't close-on-first / ⌘-click / press Enter).
    // Switching tools must NOT auto-commit a stub polyline.
    const p = setup();
    p.click(0, 0); p.click(50, 0); p.click(100, 0);
    p.deactivate();
    expect(p.adapter.addNode).not.toHaveBeenCalled();
    expect(p.scratch.current).toBeNull();
    expect(p.scratch.finishedSubpaths).toEqual([]);
  });

  it('autoSelect: false → addNode called but setSelection not called', () => {
    const p = setup({ autoSelect: false });
    p.click(0, 0); p.click(100, 0); p.click(50, 80);
    p.enter();
    expect(p.adapter.addNode).toHaveBeenCalled();
    expect(p.adapter.setSelection).not.toHaveBeenCalled();
  });

  describe('⌘-click open-finish (Illustrator convention)', () => {
    it('⌘-click after ≥2 anchors commits the path open and clears it', () => {
      const p = setup();
      p.click(0, 0); p.click(50, 0); p.click(50, 50);
      expect(p.modClick(200, 200)).toBe(true);
      expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
      expect(p.scratch.current).toBeNull();
      expect(p.adapter.added.at(-1)!.closed).toBe(false);
    });

    it('⌘-click with <2 anchors declines, so the click falls through to anchor placement', () => {
      // Strict modifier matching means the two click bindings are distinct
      // routes; declining is what lets the dispatcher try the plain one.
      const p = setup();
      p.click(0, 0);
      expect(p.modClick(50, 50)).toBe(false);
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      p.click(50, 50); // the fall-through
      expect(p.scratch.current!.anchors).toHaveLength(2);
    });

    it('the binding uses `mod`, which is meta on mac and ctrl elsewhere', () => {
      // The retired route grammar's modifier matcher accepted meta OR ctrl on
      // every platform, so ⌘-click's route also fired on Ctrl-click on mac —
      // where Ctrl-click is the context menu.
      const { tool } = setup();
      const modClick = (tool.bindings ?? []).find((b) => b.actionId === 'pen.finishOpen' && b.spec.kind === 'click');
      expect(modClick?.spec.mods).toMatchObject({ mod: true });
      expect(modClick?.spec.mods).not.toHaveProperty('ctrl');
      expect(modClick?.spec.mods).not.toHaveProperty('meta');
    });
  });

  describe('double-click open-finish (Illustrator convention)', () => {
    it('double-clicking the last anchor commits the path open, without a duplicate anchor', () => {
      // `doubleclick` is synthesized AFTER both clicks, so the second click
      // has already placed an anchor on top of the first's. The action drops
      // that duplicate before committing — net effect matches the pen's old
      // private 300ms detector, using the dispatcher's single definition of
      // a double click instead of a fourth one.
      const p = setup();
      p.click(0, 0);
      p.doubleClick(50, 0);
      expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
      expect(p.adapter.added[0].closed).toBe(false);
      expect(p.scratch.current).toBeNull();
      // Two anchors survive: (0,0) and the first of the double-click pair.
      expect(p.adapter.added[0].path.commands).toHaveLength(2);
    });

    it('drops exactly one anchor, wherever the double-click lands', () => {
      // The dropped anchor is by construction the one the second click just
      // appended, so there is no position test to get wrong — the pen's old
      // detector needed one only because it had to decide, mid-click,
      // whether a double-click was happening at all.
      const p = setup();
      p.click(0, 0); p.click(50, 0);
      p.doubleClick(500, 500);
      // (0,0), (50,0) and ONE anchor at (500,500) survive.
      expect(p.adapter.added[0].path.commands).toHaveLength(3);
    });

    it('a double-click that closes the subpath keeps every anchor', () => {
      // The second click landed on the first anchor and closed the path, so
      // the anchors already moved to `finishedSubpaths` — there is nothing
      // for the double click to undo.
      const p = setup({ closeHitRadius: 8, autoCommitOnClose: false });
      p.click(0, 0); p.click(100, 0); p.click(100, 100);
      p.doubleClick(1, 1);
      expect(p.scratch.finishedSubpaths.length + (p.scratch.current ? 1 : 0)).toBe(0);
      expect(p.adapter.added[0].closed).toBe(true);
      expect(p.adapter.added[0].path.commands).toHaveLength(4); // M L L Z
    });

    it('a double-click from idle commits nothing and leaves the pen idle', () => {
      const p = setup();
      p.doubleClick(10, 10);
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.scratch.current).toBeNull();
    });

    it('Enter on a single anchor commits nothing and leaves the pen idle', () => {
      const p = setup();
      p.click(0, 0);
      p.enter();
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.scratch.current).toBeNull();
    });

    it('Enter drops a lone trailing anchor from a compound path', () => {
      const p = setup({ autoCommitOnClose: false });
      p.click(0, 0); p.click(100, 0); p.click(100, 100); p.click(1, 1);
      p.click(300, 300);
      p.enter();
      expect(p.adapter.addNode).toHaveBeenCalledTimes(1);
      expect(p.adapter.added[0].closed).toBe(true);
      expect(p.adapter.added[0].path.commands).toHaveLength(4);
    });

    it('declines with <2 anchors', () => {
      const p = setup();
      const action = p.actionOf('pen.finishOpen');
      expect(action.enabled?.()).toBe(ActionDisabledReason.NotApplicable);
      p.click(0, 0);
      expect(action.enabled?.()).toBe(ActionDisabledReason.NotApplicable);
    });
  });
});
