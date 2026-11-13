import { addOnPages, createPageRun, createScene, pageOfNode, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { svgDraftSpecs } from './draftSpecs';
import type { SvgKitLeafData } from './fromKit';
import { parseSvg } from './parse';
import { svgNodesToKitDrafts } from './unpack';

const TEXT = `<svg xmlns="http://www.w3.org/2000/svg">
  <g><rect x="10" y="10" width="20" height="20"/></g>
  <rect x="700" y="10" width="20" height="20"/>
</svg>`;

describe('svgDraftSpecs', () => {
  // The README's import: a paged scene takes the specs through addOnPages, which puts each root on its page.
  it('adds a document onto the pages it lands on', () => {
    const scene = createScene<SvgKitLeafData | Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    createPageRun(scene, [{ id: 'p1', width: 600, height: 800 }, { id: 'p2', width: 600, height: 800 }]);
    const drafts = svgNodesToKitDrafts(parseSvg(TEXT), () => scene.mintId());
    const ids = addOnPages(scene, svgDraftSpecs(drafts, { layer: 'main', composition: scene.composition }));
    expect(ids.map((id) => pageOfNode(scene, id))).toEqual(['p1', 'p1', 'p2']);
  });
});
