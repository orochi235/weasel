import { describe, expect, it } from 'vitest';
import { createScene } from '../scene/scene';
import type { AddNodeSpec, NodeId } from '../scene/types';
import { adoptLegacyPages } from './legacyPages';
import { addPage } from './pageEdits';
import { placeOnPages } from './placeOnPages';
import { PAGES_DOC_KEY, type PagesDoc } from './pageEdits';
import { createPageRun, pageNodeOf, pageOfNode, pageRunOf } from './pageNodes';

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
  it('gives a page whose id a content node holds a node id of its own', () => {
    const scene = load([rect('b', 115), rect('onA', 5)]);
    expect(adoptLegacyPages(scene)).toBe(true);
    const back = pageNodeOf(scene, 'b')!;
    expect(back).not.toBe('b');
    expect(scene.get(back)!.page).toEqual({ id: 'b', name: 'Back' });
    expect(scene.get('b' as NodeId)!.parent).toBe(back);
    expect(pageOfNode(scene, 'b' as NodeId)).toBe('b');
    expect(scene.get('onA' as NodeId)!.parent).toBe('a');
  });

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

  it('puts a follower of nodes all on one page on that page, in its slot', () => {
    const scene = load([rect('a1', 5), {
      id: 'mid' as NodeId, kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 0, height: 0 }, data: { n: 'mid' },
      dependsOn: ['a1' as NodeId, 'a2' as NodeId],
    }, rect('a2', 50)]);
    adoptLegacyPages(scene);
    expect(scene.childrenOf('a' as NodeId)).toEqual(['a1', 'mid', 'a2']);
  });

  it('puts a follower of a follower where the one it follows goes, whichever comes first', () => {
    const follower = (id: string, deps: string[]): Spec => ({
      id: id as NodeId, kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 0, height: 0 }, data: { n: id },
      dependsOn: deps as NodeId[],
    });
    const scene = load([rect('a1', 5), rect('a2', 50), follower('link', ['a1', 'a2']), follower('tag', ['link'])]);
    scene.untracked(() => scene.reorder('tag' as NodeId, 0));
    expect(scene.roots[0]).toBe('tag');
    adoptLegacyPages(scene);
    expect(scene.get('link' as NodeId)!.parent).toBe('a');
    expect(scene.get('tag' as NodeId)!.parent).toBe('a');
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

  it('puts a root on the page pageOf names, unmoved, and one naming no page the scene has by its bounds', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    createPageRun(scene, TWO.pages, TWO.layout);
    for (const spec of [rect('mostlyOnB', 95, 40), rect('nowhere', 115)]) scene.add(spec);
    const named: Record<string, string> = { mostlyOnB: 'a', nowhere: 'gone' };
    placeOnPages(scene, ['mostlyOnB' as NodeId, 'nowhere' as NodeId], { pageOf: (id) => named[id] });
    expect(scene.get('mostlyOnB' as NodeId)!).toMatchObject({ parent: 'a', pose: { x: 95 } });
    expect(scene.get('nowhere' as NodeId)!).toMatchObject({ parent: 'b', pose: { x: 5 } });
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

describe('turning the pasteboard off', () => {
  it('puts what sits off every page on the nearest page, in the same undo entry', () => {
    const scene = createScene<{ n: string }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
    const run = createPageRun(scene, TWO.pages, { ...TWO.layout, pasteboard: true });
    scene.add(rect('far', 400));
    const depth = scene.historyEntries().length;
    scene.setPageRun(run, { ...scene.get(run)!.pageRun!, pasteboard: false });
    expect(scene.get('far' as NodeId)!).toMatchObject({ parent: 'b', pose: { x: 99 } });
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(scene.get('far' as NodeId)!).toMatchObject({ parent: null, pose: { x: 400 } });
    expect(scene.get(run)!.pageRun!.pasteboard).toBe(true);
  });
});

describe('placing locked content on pages', () => {
  type Two = { n: string };
  const twoLayers = () => createScene<Two, 'paper' | 'ink', Pose>({ systemLayers: [{ id: 'paper' }, { id: 'ink' }] });
  const far = { id: 'far' as NodeId, kind: 'mark' as const, layer: 'ink' as const, pose: { x: 400, y: 5, width: 10, height: 10 }, data: { n: 'far' } };

  it('turning the pasteboard off moves a locked root on the pasteboard onto a page', () => {
    const scene = twoLayers();
    const run = createPageRun(scene, TWO.pages, { ...TWO.layout, pasteboard: true });
    scene.add(far);
    scene.setLocked(far.id, true);
    scene.setPageRun(run, { ...scene.get(run)!.pageRun!, pasteboard: false });
    expect(scene.get(far.id)!).toMatchObject({ parent: 'b', locked: true });
  });

  it('addPage on a Continuous scene moves a locked root, and one on a locked layer, onto the page', () => {
    for (const lock of ['node', 'layer'] as const) {
      const scene = twoLayers();
      scene.add(far);
      if (lock === 'node') scene.setLocked(far.id, true);
      else scene.setLayerLocked('ink', true);
      addPage(scene, { id: 'p', width: 100, height: 50 });
      expect(scene.get(far.id)!.parent).toBe('p');
    }
  });

  it('addPage succeeds with the pages\' layer locked', () => {
    const scene = twoLayers();
    createPageRun(scene, TWO.pages, TWO.layout);
    scene.setLayerLocked('paper', true);
    addPage(scene, { id: 'c', width: 100, height: 50 });
    expect(scene.childrenOf(pageRunOf(scene)!)).toEqual(['a', 'b', 'c']);
  });
});
