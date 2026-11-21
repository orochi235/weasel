import { createScene } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import type { SequenceData } from '@weasel-js/diagram';
import type { DiagramDocument } from './document';
import { documentFromScene } from './fromScene';
import { scenePageKinds } from './pageKinds';
import { MEASURE, THEME, pagedDocScene } from './testing/docScene';
import { documentSpecs } from './toScene';

const SEQUENCE: SequenceData = { participants: [{ id: 'a' }, { id: 'b' }], steps: [{ kind: 'message', id: 'm', from: 'a', to: 'b', text: 'hi', line: 'solid', head: 'arrow' }] };

/** A sequence's root and then a plot's root, both on page `p1`; `p2` empty. */
function bothOnOnePage() {
  const doc: DiagramDocument = {
    pages: [
      { kind: 'sequence', id: 's', width: 200, height: 200, data: SEQUENCE },
      { kind: 'plot', id: 'c', width: 200, height: 150, data: { kind: 'pie', slices: [{ label: 'A', value: 1 }] } },
    ],
  };
  return pagedDocScene(documentSpecs(doc, { theme: THEME, measure: MEASURE }).specs);
}

describe('a page holding both a plot root and a sequence root', () => {
  it('is a plot page to documentFromScene and to scenePageKinds alike', () => {
    const scene = bothOnOnePage();
    expect(documentFromScene(scene).pages.map((p) => [p.id, p.kind])).toEqual([['p1', 'plot'], ['p2', 'graph']]);
    expect([...scenePageKinds(scene, { page: 'p1' })]).toEqual(['plot']);
    expect([...scenePageKinds(scene)].sort()).toEqual(['graph', 'plot']);
  });
});

describe('scenePageKinds on a scene with no page list', () => {
  it('answers for the one page documentFromScene makes, and throws for any other name, as writtenPage does', () => {
    const scene = createScene<unknown, string, { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });
    const [page] = documentFromScene(scene).pages;
    expect([...scenePageKinds(scene, { page: page!.id })]).toEqual(['graph']);
    expect([...scenePageKinds(scene, { page: undefined })]).toEqual(['graph']);
    expect(() => scenePageKinds(scene, { page: 'p2' })).toThrow(RangeError);
  });
});
