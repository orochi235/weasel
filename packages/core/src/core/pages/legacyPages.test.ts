import { describe, expect, it } from 'vitest';
import { createScene } from '../scene/scene';
import type { AddNodeSpec, NodeId } from '../scene/types';
import { adoptLegacyPages, placeOnPages } from './legacyPages';
import { PAGES_DOC_KEY, type PagesDoc } from './pageEdits';
import { createPageRun, pageRunOf } from './pageNodes';

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
    // Moved so 1 unit of it is on page a (0..100), not left clipped to nothing.
    expect(scene.get(inGap)!.pose.x).toBe(99);
  });

  it('moves a root wholly off every page onto the nearest one, its children with it', () => {
    const scene = load([
      { ...rect('far', 400), kind: 'group', pose: { x: 400, y: 300, width: 10, height: 10 } },
      { ...rect('kid', 2), parent: 'far' as NodeId, pose: { x: 2, y: 2, width: 2, height: 2 } },
    ]);
    adoptLegacyPages(scene);
    const far = scene.get('far' as NodeId)!;
    expect(far.parent).toBe('b');
    // Page b spans world (110..210, 0..50): 1 unit of the root is left on it.
    expect(far.pose).toMatchObject({ x: 99, y: 49 });
    expect(scene.get('kid' as NodeId)!.pose).toMatchObject({ x: 2, y: 2 });
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

describe('placeOnPages', () => {
  it('moves roots added to a paged scene onto their pages, inside the caller\'s undo entry', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    createPageRun(scene, TWO.pages, TWO.layout);
    scene.batch('Open', () => {
      for (const spec of [rect('onA', 5), rect('onB', 115)]) scene.add(spec);
      placeOnPages(scene, ['onA' as NodeId, 'onB' as NodeId]);
    });
    expect(scene.get('onB' as NodeId)!).toMatchObject({ parent: 'b', pose: { x: 5 } });
    expect(scene.get('onA' as NodeId)!).toMatchObject({ parent: 'a', pose: { x: 5 } });
    expect(scene.historyEntries().at(-1)!.label).toBe('Open');
    scene.undo();
    expect(scene.get('onB' as NodeId)).toBeUndefined();
  });

  it('with the pasteboard on, leaves a root off every page where it is', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    createPageRun(scene, TWO.pages, { ...TWO.layout, pasteboard: true });
    for (const spec of [rect('gap', 102, 2), rect('onB', 115)]) scene.add(spec);
    placeOnPages(scene, ['gap' as NodeId, 'onB' as NodeId]);
    expect(scene.get('gap' as NodeId)!).toMatchObject({ parent: null, pose: { x: 102 } });
    expect(scene.get('onB' as NodeId)!).toMatchObject({ parent: 'b', pose: { x: 5 } });
  });

  it('leaves a scene without pages alone', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }], initial: [rect('r', 115)] });
    placeOnPages(scene, ['r' as NodeId]);
    expect(scene.get('r' as NodeId)!).toMatchObject({ parent: null, pose: { x: 115 } });
  });
});
