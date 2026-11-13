import { useMemo, useState } from 'react';
import {
  SceneCanvas, asNodeId, createPageRun, createPresentationContribution, createScene, fitViewToPage, createPagesLayer, placedPagesOf,
  solid, type Path, type PlacedPage, type RectPose,
} from '@weasel-js/core';

const W = 640, H = 360;
const SLIDE = { width: 320, height: 180 };
const SLIDES = [
  { id: 'title', heading: 'Quarterly review', color: '#3d6bd8' },
  { id: 'growth', heading: 'Growth', color: '#2f9e6e' },
  { id: 'risks', heading: 'Risks', color: '#d8693d' },
  { id: 'next', heading: 'Next steps', color: '#8a4fd8' },
];

type Data = { text?: string; style?: { fontSize: number }; path?: Path; fill?: { paint: ReturnType<typeof solid> } };

/** A paged scene: one page per slide, each holding its heading and a colored bar. */
function deck() {
  const scene = createScene<Data, 'paper', RectPose>({ systemLayers: [{ id: 'paper' }] });
  createPageRun(scene, SLIDES.map((s) => ({ id: s.id, ...SLIDE })), { gap: 60 });
  for (const s of SLIDES) {
    scene.add({
      kind: 'mark', layer: 'paper', parent: asNodeId(s.id), pose: { x: 24, y: 24, width: 272, height: 40 },
      data: { text: s.heading, style: { fontSize: 26 }, fill: { paint: solid('#1d1d1f') } },
    });
    scene.add({
      kind: 'mark', layer: 'paper', parent: asNodeId(s.id), pose: { x: 24, y: 120, width: 272, height: 20 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { paint: solid(s.color) } },
    });
  }
  return scene;
}

export function SlideNavigationDemo() {
  const [scene] = useState(deck);
  const pages = useMemo(() => placedPagesOf(scene), [scene]);
  const [shown, setShown] = useState<PlacedPage>(pages[0]!);
  const ambient = useMemo(() => [createPresentationContribution({ onPage: setShown })], []);
  const layers = useMemo(() => ({ pages: { layer: createPagesLayer(pages, { fill: '#ffffff' }), before: 'scene' as const } }), [pages]);
  const start = useMemo(() => fitViewToPage(pages[0]!, { width: W, height: H }, { x: 0, y: 0, scale: { x: 1, y: 1 } }) ?? undefined, [pages]);
  return (
    <div>
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          backgroundFill={{ color: '#2b2b30' }}
          scene={scene}
          layers={layers}
          ambient={ambient}
          {...(start ? { defaultView: start } : {})}
        />
      </div>
      <p className="ckd-readout" aria-live="polite">Slide {shown.index + 1} of {pages.length}</p>
    </div>
  );
}
