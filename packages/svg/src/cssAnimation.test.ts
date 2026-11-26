import { describe, expect, it } from 'vitest';
import { bindClip, type ClipSampledTrack } from '@weasel-js/animator';
import { createScene, type PoseComposition, type RectPose } from '@weasel-js/core';
import { parseSvg, svgClipBinder, svgDraftSpecs, svgNodesToKitDrafts, type SvgDraftPose } from './index';

const doc = (css: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg"><style>${css}</style>${body}</svg>`;
const track = (svg: string, target: string) => {
  const parsed = parseSvg(svg);
  return { parsed, track: parsed.clip?.tracks.find((t) => (t as ClipSampledTrack).target === target) as ClipSampledTrack | undefined };
};

describe('CSS animation import', () => {
  it('reads an animation\'s keyframes into a track named for the element and property', () => {
    const { track: t } = track(doc('@keyframes fade { from { opacity: 0 } to { opacity: 1 } } #r { animation: fade 2s linear forwards }',
      '<rect id="r" width="10" height="10"/>'), 'r.opacity');
    expect(t?.keys).toEqual([{ t: 0, value: 0 }, { t: 2000, value: 1 }]);
  });

  it('loops a rotation that runs forever, about its transform-origin', () => {
    const { parsed, track: t } = track(
      doc('@keyframes spin { to { transform: rotate(1turn) } } #g { animation: spin 1s linear infinite; transform-origin: 5px 5px }',
      '<g id="g"><rect width="10" height="10"/></g>'),
      'g.transform.rotate',
    );
    expect(t?.keys.map((k) => k.value)).toEqual([[0, 5, 5], [360, 5, 5]]);
    expect(parsed.clip?.loop).toBe(true);
    expect(parsed.clip?.duration).toBe(1000);
    expect(parsed.animatedTransforms?.g).toBeDefined();
  });

  it('runs an alternate pass backward, its easing reversed, and starts from the element\'s own value without keyframes for it', () => {
    const { track: t } = track(
      doc('@keyframes grow { to { stroke-width: 6 } } #p { animation: grow 1s ease-in 2 alternate forwards }',
      '<path id="p" d="M0 0L10 0" stroke="#000" stroke-width="2"/>'),
      'p.stroke-width',
    );
    expect(t?.keys.map((k) => [k.t, k.value])).toEqual([[0, 2], [1000, 6], [1000, 6], [2000, 2]]);
    expect(t?.keys[1].easing).toEqual({ bezier: [0.42, 0, 1, 1] });
    const back = (t?.keys[3].easing as { bezier: readonly number[] }).bezier;
    [0, 0, 0.58, 1].forEach((v, i) => expect(back[i]).toBeCloseTo(v, 12));
  });

  it('holds the element\'s own value through a delay and goes back to it at the end, without a fill', () => {
    const { track: t } = track(
      doc('@keyframes f { from { opacity: 0.2 } to { opacity: 1 } } #r { animation: f 1s steps(4) 500ms }',
      '<rect id="r" width="10" height="10" opacity="0.5"/>'),
      'r.opacity',
    );
    expect(t?.keys.map((k) => [k.t, k.value])).toEqual([[0, 0.5], [500, 0.2], [1500, 1], [1500, 0.5]]);
    expect(t?.keys[1].easing).toEqual({ steps: 1 });
    expect(t?.keys[2].easing).toEqual({ steps: 4, jump: 'end' });
  });

  it('gives an animated element with no id one, and warns of an animation no @keyframes defines', () => {
    const parsed = parseSvg(doc('@keyframes f { to { opacity: 0 } } rect { animation: f 1s } circle { animation: nope 1s }',
      '<rect width="10" height="10"/><circle r="4"/>'));
    expect(parsed.clip?.tracks.map((t) => (t as ClipSampledTrack).target)).toEqual(['css-1.opacity']);
    expect(parsed.warnings.some((w) => w.includes('"nope"'))).toBe(true);
  });

  it('binds through svgClipBinder as SMIL\'s tracks do', () => {
    const parsed = parseSvg(doc('@keyframes spin { to { transform: rotate(90deg) } } @keyframes f { to { fill: #00f } } '
      + '#g { animation: spin 1s } #r { animation: f 1s }', '<g id="g"><rect id="r" width="10" height="10" fill="#f00"/></g>'));
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    let n = 0;
    const drafts = svgNodesToKitDrafts(parsed, () => `n${++n}`);
    for (const spec of svgDraftSpecs(drafts, { layer: 'main', composition: scene.composition as PoseComposition<SvgDraftPose> })) scene.add(spec as never);
    const binder = svgClipBinder(scene, parsed, drafts);
    expect(() => bindClip(parsed.clip!, binder)).not.toThrow();
  });
});
