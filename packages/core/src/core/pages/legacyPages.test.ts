import { describe, expect, it } from 'vitest';
import { createScene } from '../scene/scene';
import type { AddNodeSpec, NodeId } from '../scene/types';
import { adoptLegacyPages } from './legacyPages';
import { PAGES_DOC_KEY, type PagesDoc } from './pageEdits';
import { pageRunOf } from './pageNodes';

type Pose = { x: number; y: number; width: number; height: number };

const TWO: PagesDoc = {
  pages: [{ id: 'a', width: 100, height: 50 }, { id: 'b', width: 100, height: 50, name: 'Back' }],
  layout: { direction: 'row', gap: 10 },
};

type Spec = AddNodeSpec<{ n: string }, 'l', Pose>;

const rect = (id: string, x: number, width = 10): Spec => ({
  id: id as NodeId, kind: 'mark', layer: 'l', pose: { x, y: 5, width, height: 10 }, data: { n: id },
});

/** A scene as a load leaves it: its nodes and the pages doc, and no history. */
const load = (initial: Spec[]) =>
  createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }], doc: { [PAGES_DOC_KEY]: TWO }, initial });

describe('adoptLegacyPages', () => {
  it('turns a pages doc into page nodes and moves each root into its page', () => {
    const scene = load([rect('onB', 115)]);
    const onB = 'onB' as NodeId;
    expect(scene.historyEntries()).toEqual([]);
    expect(adoptLegacyPages(scene)).toBe(true);
    expect(scene.get(onB)!.parent).toBe('b');
    expect(scene.get(onB)!.pose.x).toBe(5);
    expect(scene.get('b' as NodeId)!.page).toEqual({ name: 'Back' });
    expect(scene.get(pageRunOf(scene)!)!.pageRun).toEqual({ direction: 'row', gap: 10 });
    expect(scene.doc.get(PAGES_DOC_KEY)).toBeUndefined();
    expect(scene.historyEntries()).toEqual([]);
  });

  it('converts inside a caller\'s batch, rebasing against pages already in place', () => {
    const scene = load([rect('onB', 115)]);
    scene.batch('Open', () => {
      adoptLegacyPages(scene);
      expect(scene.get('onB' as NodeId)!.pose.x).toBe(5);
    });
    expect(scene.get('onB' as NodeId)!.pose.x).toBe(5);
    expect(scene.get('onB' as NodeId)!.parent).toBe('b');
  });

  it('drops a pages doc left beside an existing page run', () => {
    const scene = load([]);
    adoptLegacyPages(scene);
    scene.untracked(() => scene.doc.set(PAGES_DOC_KEY, TWO));
    expect(adoptLegacyPages(scene)).toBe(false);
    expect(scene.doc.get(PAGES_DOC_KEY)).toBeUndefined();
  });

  it('does nothing the second time', () => {
    const scene = load([]);
    expect(adoptLegacyPages(scene)).toBe(true);
    expect(adoptLegacyPages(scene)).toBe(false);
  });

  it('puts a root in the gap on the nearer page', () => {
    const scene = load([rect('gap', 102, 2)]);
    const inGap = 'gap' as NodeId;
    adoptLegacyPages(scene);
    expect(scene.get(inGap)!.parent).toBe('a');
    expect(scene.get(inGap)!.pose.x).toBe(102);
  });

  it('puts a follower in the run', () => {
    const scene = load([rect('onA', 5), rect('onB', 115), {
      id: 'link' as NodeId, kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 0, height: 0 }, data: { n: 'link' },
      dependsOn: ['onA' as NodeId, 'onB' as NodeId],
    }]);
    const link = 'link' as NodeId;
    adoptLegacyPages(scene);
    expect(scene.get(link)!.parent).toBe(pageRunOf(scene));
  });
});
