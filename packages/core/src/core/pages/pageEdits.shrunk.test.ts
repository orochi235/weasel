/** Counterexamples the page-edit property test shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createScene } from '../scene/scene';
import { addPage, pagesOf } from './pageEdits';
import { createPageRun } from './pageNodes';

describe('page edits, shrunk counterexamples', () => {
  it('addPage holds a negative index to the front, as movePage does', () => {
    const scene = createScene<unknown, 'l', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'l' }] });
    createPageRun(scene, [{ id: 'page-1', width: 1, height: 1 }, { id: 'page-2', width: 1, height: 1 }]);
    addPage(scene, { id: 'page-3', width: 1, height: 1 }, { index: -1 });
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['page-3', 'page-1', 'page-2']);
  });
});
